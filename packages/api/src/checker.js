import { logger } from '@karimsa/boa'
import Docker from 'dockerode'
import ms from 'ms'

import { model } from './db'
import * as queue from './queue'

const docker = new Docker()

async function updateServiceCheck(serviceCheck) {
	try {
		logger.info(`Updating check %O for service %O: %O`, serviceCheck.check.name, serviceCheck.service, serviceCheck)
		const name = (`patrol-${serviceCheck.service}-${serviceCheck.check.name}`).toLowerCase().replace(/[^\w]+/g, '_')
		const oldContainer = await docker.getContainer(name)
		try {
			await oldContainer.remove()
			logger.info(`Killed existing container: %O`, name)
		} catch (error) {
			if (!String(error).includes('no such container')) {
				throw error
			}
		}

		const container = await docker.createContainer({
			name,
			Image: serviceCheck.check.image,
			AttachStdin: false,
			AttachStdout: true,
			AttachStderr: true,
			Tty: false,
			Cmd: ['/bin/sh', '-c', serviceCheck.check.check],
			OpenStdin: false,
			StdinOnce: false,
		})

		const stream = await container.attach({
			stream: true,
			stdout: true,
			stderr: true,
		})
		stream.pipe(process.stdout)

		await container.start()

		let serviceStatus = 'healthy'
		let serviceError
		try {
			await container.wait()
		} catch (error) {
			serviceStatus = 'unhealthy'
			serviceError = error
		}

		logger.info(`Service check %O for service %O returned %O status`, serviceCheck.check.name, serviceCheck.service, serviceStatus)
		await model('Checks').insert({
			service: serviceCheck.service,
			check: serviceCheck.check.name,
			createdAt: Date.now(),
			serviceStatus,
			serviceError,
		})

		await container.remove()
	} catch (error) {
		logger.error(`Failed to run service check %O for service %O (halting service check)`, error, serviceCheck.check.name, serviceCheck.service)
	}
}

async function initServiceCheck(serviceCheck) {
	const lastRun = await model('Checks').findOne({
		service: serviceCheck.service,
		check: serviceCheck.check.name,
	})

	// If there is a previous fresh run, we only need to update after
	// the check runs stale
	if (lastRun && Date.now() < lastRun.createdAt + serviceCheck.check.interval) {
		logger.info(
			`Scheduling service check %O for service %O for %O from now`,
			serviceCheck.check.name,
			serviceCheck.service,
			ms((lastRun.createdAt + serviceCheck.check.interval) - Date.now()),
		)
		queue.Enqueue({
			readyAt: lastRun.createdAt + serviceCheck.check.interval,
			run: () => updateServiceCheck(serviceCheck),
		})
		return
	}

	queue.Enqueue(() => updateServiceCheck(serviceCheck))
}

export async function startWithConfig({ config }) {
	logger.info('Initializing with config: %O', config)

	for (const name in config.services) {
		if (config.services.hasOwnProperty(name)) {
			for (const check of config.services[name]) {
				queue.Enqueue(() => initServiceCheck({
					service: name,
					check,
				}))
			}
		}
	}
}
