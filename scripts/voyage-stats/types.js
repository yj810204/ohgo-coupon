/**
 * @typedef {Object} ParsedPassenger
 * @property {string | null} name
 * @property {string} birth
 * @property {string} gender
 * @property {number | null} age
 * @property {string} ageBucket
 */

/**
 * @typedef {Object} TripRecord
 * @property {string} date
 * @property {number} tripNumber
 * @property {string} confirmedAt
 * @property {boolean} confirmed
 * @property {boolean} imageAvailable
 * @property {string | null} rosterImageUrl
 * @property {number | null} passengerCount
 * @property {string} ocrStatus
 * @property {ParsedPassenger[]} [passengers]
 */

/**
 * @typedef {Object} VoyageStatsConfig
 * @property {{ apiKey: string, projectId: string, storageBucket: string }} firebase
 * @property {string} visionProjectId
 * @property {string} dateStart
 * @property {string} dateEnd
 * @property {number} maxTripsPerDay
 * @property {string} outputDir
 * @property {number} visionDelayMs
 * @property {boolean} skipOcr
 */

module.exports = {};
