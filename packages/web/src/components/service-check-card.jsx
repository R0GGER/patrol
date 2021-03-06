/** @jsx jsx */

import $ from 'jquery'
import PropTypes from 'prop-types'
import { jsx, css } from '@emotion/core'
import moment from 'moment'
import { useEffect, useState } from 'react'

import { Checks, CheckType } from '../models/checks'
import { ServiceChart } from './service-chart'

const numHistoryBars =
	!process.env.IS_SERVER && screen.availWidth > 767 ? 80 : 40
const barWidth = 2
const barSpacing = 2
const svgWidth = numHistoryBars * barWidth + (numHistoryBars - 1) * barSpacing

const colorGray = '#d9dbde'
const colorBlue = '#007bff'

const STATUS_COLORS = {
	healthy: '#00eb8b',
	unhealthy: '#dc3545',
	'was-unhealthy': '#ffce00',
}

const STATUS_COLOR_LABELS = {
	healthy: 'success',
	unhealthy: 'danger',
	'was-unhealthy': 'warning',
}

function createElms(length, fn) {
	const elms = new Array(length)
	for (let i = 0; i < length; ++i) {
		elms[i] = fn(i)
	}
	return elms
}

export function ServiceCheckCard({ service, check: firstCheck }) {
	const historyState = Checks.getHistory({
		service,
		check: firstCheck.check,
		$limit: numHistoryBars,
	})
	const numDimBars = historyState.result
		? numHistoryBars - historyState.result.length
		: 0
	const latestCheck =
		(historyState.result &&
			historyState.result[historyState.result.length - 1]) ||
		firstCheck

	let [selectedCheck, setSelectedCheck] = useState()
	if (!selectedCheck && latestCheck && latestCheck.status === 'unhealthy') {
		setSelectedCheck((selectedCheck = latestCheck))
	}

	useEffect(() => {
		$('[data-toggle="tooltip"]').tooltip()
	})

	return (
		<div className="card">
			<div className="card-body">
				<div className="row">
					<div className="col">
						<div className="d-flex justify-content-between">
							<p className="font-weight-bold mb-0 d-inline-block">
								{latestCheck.check}
								{(historyState.status === 'idle' ||
									historyState.status === 'inprogress') && (
									<span
										className="ml-2 spinner-grow spinner-grow-sm text-primary"
										role="status"
									></span>
								)}
							</p>
							<p
								className={`font-weight-bold mb-0 d-inline-block d-flex align-items-center text-${
									STATUS_COLOR_LABELS[latestCheck.serviceStatus]
								}`}
							>
								<span>
									{latestCheck.serviceStatus === 'healthy'
										? 'Healthy'
										: latestCheck.serviceStatus === 'unhealthy'
										? 'Unhealthy'
										: latestCheck.serviceStatus === 'was-unhealthy'
										? 'Healthy (Recovered)'
										: 'In Progress'}
								</span>
								<span className="small text-muted ml-2 d-none d-sm-inline">
									{moment(latestCheck.createdAt).fromNow()}
								</span>
							</p>
						</div>
						<div className="d-sm-none">
							<span className="small text-muted d-block text-right">
								{moment(latestCheck.createdAt).fromNow()}
							</span>
						</div>
					</div>
				</div>

				<div className="row mt-4">
					<div className="col">
						{historyState.error && (
							<div className="alert alert-danger">
								{String(historyState.error)}
							</div>
						)}
						{historyState.result &&
							historyState.result[0] &&
							historyState.result[0].checkType === 'metric' && (
								<ServiceChart entries={historyState.result} />
							)}
						{historyState.result &&
							historyState.result[0] &&
							historyState.result[0].checkType !== 'metric' && (
								<svg
									className="w-100"
									viewBox={`0 0 ${svgWidth} 10`}
									css={css`
										height: 2rem;
									`}
								>
									{createElms(numDimBars, index => (
										<rect
											key={index}
											height="10"
											width={barWidth}
											x={index * (barWidth + barSpacing)}
											y="0"
											fill={colorGray}
										/>
									))}

									{historyState.result.map((historyEntry, index) => (
										<rect
											key={index + numDimBars}
											title={moment(historyEntry.createdAt).format(
												'MMM D hh:mm:ss a',
											)}
											data-toggle="tooltip"
											height="10"
											width={barWidth}
											x={(index + numDimBars) * (barWidth + barSpacing)}
											y="0"
											className="clickable"
											onClick={() => {
												setSelectedCheck(historyEntry)
											}}
											fill={
												STATUS_COLORS[historyEntry.serviceStatus] || colorBlue
											}
										/>
									))}
								</svg>
							)}
					</div>
				</div>

				{selectedCheck && (
					<div className="row">
						<div className="col">
							<div className="mt-4 p-4 bg-light rounded">
								<pre
									className="mb-0"
									css={css`
										overflow-x: auto;
										white-space: pre-wrap;
										white-space: -moz-pre-wrap;
										white-space: -pre-wrap;
										white-space: -o-pre-wrap;
										word-wrap: break-word;
									`}
								>
									Date:{' '}
									{moment(selectedCheck.createdAt).format('MMM D hh:mm:ss a')}
									{'\n\n'}
									{selectedCheck.output}
								</pre>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

ServiceCheckCard.propTypes = {
	service: PropTypes.string.isRequired,
	check: CheckType.isRequired,
}
