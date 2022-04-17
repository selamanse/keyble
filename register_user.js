#!/usr/bin/env node

/**
 * Use "strict" mode.
 */
'use strict';

/**
 * The "register_user" submodule.
 * Command line tool for registering users on eQ-3 eqiva Bluetooth smart locks.
 * @module register_user
 */

/**
 * Import/require the "keyble" submodule.
 */
const keyble = require('./keyble');

/**
 * Import required functions from the "utils" submodule.
 */
const {ansi_colorize, wait_milliseconds} = require('./utils.js');

/**
 * Import required functions from the "cli" submodule.
 */
const {ArgumentParser, generate_input_strings} = require('./cli.js');

const { createLogger, format, transports } = require('winston');
const { cli } = format;

const logger = createLogger({
	level: 'debug',
	format: cli(),
	transports: [
	  new transports.Console({ level: 'debug' }),
	],
  });

/**
 * The default user name to use when registering new users.
 * @constant
 * @type {string}
 */
const DEFAULT_USER_NAME = 'keyble';

const register_user = async (key_card_data_string, user_name) => {
	// Parse/Decode the information encoded in the QR-Codes on the "Key Card"s
	logger.info(key_card_data_string)
	const {address, key, serial} = keyble.key_card.parse(key_card_data_string);
	logger.info(`Registering user on Smart Lock with address "${ansi_colorize(address)}", card key "${ansi_colorize(key)}" and serial "${ansi_colorize(serial)}"...`);
	const key_ble = new keyble.Key_Ble({
		address: address,
	});
	logger.info('pairing_request start')
	const {user_id, user_key} = await key_ble.pairing_request(key);
	logger.info(`User registered!`);
	logger.info(`Use arguments: "${ansi_colorize(`--address ${address} --user_id ${user_id} --user_key ${user_key}`)}"`);
	logger.info(`Setting user name to "${user_name}"...`);
	await key_ble.set_user_name(user_name);
	logger.info(`User name changed!`);
	logger.info(`Finished registering user.`);
	await key_ble.disconnect();
}

const register_users_then_exit = async (qr_code_data, user_name) => {
	// Print a short message remembering the user that he needs to activate the Smart Lock pairing mode
	logger.info(ansi_colorize('Press and hold "Unlock" button until the yellow light flashes in order to enter pairing mode', '41'));
	if (qr_code_data) {
		// If the QR code was provided on the command line, give the user 10 seconds to press and hold the "unlock" button for pairing
		logger.info("waiting for you to press unlock...")
		await wait_milliseconds(2000);
	}
	try {
		logger.info("trying to register user...")
		for await (let key_card_data_string of generate_input_strings([qr_code_data], process.stdin)) {
			await register_user(key_card_data_string, user_name);
		}
		// "noble", the Bluetooth library being used, does not properly shut down. An explicit process.exit() is required when finished.
		process.exit(0);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

/**
 * MAIN
 */
// Only execute the following code when run from the command line
if (require.main === module) {
	// Set up the command line arguments parser.
	const argument_parser = new ArgumentParser({
		description: "Register users on eQ-3 eqiva Bluetooth smart locks.",
	});
	argument_parser.add_argument('--user_name', '-n', {
		default: DEFAULT_USER_NAME,
		type: String,
		help: `The name of the user to register (default: "${DEFAULT_USER_NAME}")`,
	});
	argument_parser.add_argument('--qr_code_data', '-q', {
		required: false,
		type: String,
		help: 'The information encoded in the QR-Code of the key card. If not provided on the command line, the data will be read as input lines from STDIN instead',
	});
	const {qr_code_data, user_name} = argument_parser.parse_args();
	// Register users, then exit
	register_users_then_exit(qr_code_data, user_name);
}

