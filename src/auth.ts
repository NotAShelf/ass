/**
 * Used for global auth management
 */

import fs from 'fs-extra';
import { log, path, arrayEquals } from './utils';
import { nanoid } from 'nanoid';
import { User, Users, OldUsers } from './types/auth';
import { Request } from 'express';

/**
 * !!!!!
 * Things for tycrek to do:
 * - [ ] Add a way to configure passwords
 * - [ ] Create new users
 * - [ ] Modify user (admin, meta, replace token/token history)
 * - [ ] Delete user
 * - [x] Get user
 * - [x] Get users
 * - [x] Get user by token
 */

/**
 * Map of users
 */
export const users = new Map<string, User>();

/**
 * Migrates the old auth.json format to the new one
 * @since v0.14.0
 */
const migrate = (): Promise<Users> => new Promise(async (resolve, reject) => {

	// Get ready to read the old auth.json file
	const authPath = path('auth.json');
	const oldUsers = fs.readJsonSync(authPath).users as OldUsers;

	// Create a new users object
	const newUsers: Users = { users: {}, meta: {} };
	newUsers.migrated = true;

	// Loop through each user
	Object.entries(oldUsers).forEach(([token, { username }]) => {

		// Create a new user object
		const id = nanoid();
		const newUser: User = {
			username: username,
			passhash: '', // TODO: Figure out how to configure passwords
			token,
			admin: Object.keys(oldUsers).indexOf(token) === 0,
			meta: {}
		};

		newUsers.users[id] = newUser;
	});

	// Save the new users object to auth.json
	fs.writeJson(authPath, newUsers, { spaces: '\t' })
		.then(() => resolve(newUsers))
		.catch(reject);
});

/**
 * This is a WIP
 */
export const createNewUser = (username: string, passhash: string, admin: boolean, meta?: { [key: string]: User }): Promise<User> => new Promise(async (resolve, reject) => {

	// todo: finish this

	// Create a new user object
	const id = nanoid();
	const newUser: User = {
		username,
		passhash,
		token: nanoid(32),
		admin,
		meta: meta || {}
	};

	// Add the user to the users map
	users.set(id, newUser);

	// Save the new user to auth.json
	const authPath = path('auth.json');
	const auth = fs.readJsonSync(authPath) as Users;
	auth.users[id] = newUser;
	fs.writeJson(authPath, auth, { spaces: '\t' });
});


/**
 * Called by ass.ts on startup
 */
export const onStart = (authFile = 'auth.json') => new Promise((resolve, reject) => {
	const file = path(authFile);

	log.debug('Reading', file);

	// Check if the file exists
	fs.stat(file)

		// Create the file if it doesn't exist
		.catch((_errStat) => {
			log.debug('File does not exist', authFile, 'will be created automatically');
			return fs.writeJson(file, { migrated: true });
		})
		.catch((errWriteJson) => log.error('Failed to create auth.json').callback(reject, errWriteJson))

		// File exists or was created
		.then(() => fs.readJson(file))
		.then((json: Users) => {

			// Check if the file is the old format
			if (json.migrated === undefined || !json.migrated) return (
				log.debug('auth.json is in old format, migrating'),
				migrate());
			else return json;
		})
		.then((json: Users) => {

			// Check if the file is empty
			if (Object.keys(json).length === 0) {
				log.debug('auth.json is empty, creating default user');
				//return createDefaultUser(); // todo: need to do this
			}

			// Add users to the map
			Object.entries(json.users).forEach(([uuid, user]) => users.set(uuid, user));
		})
		.catch((errReadJson) => log.error('Failed to read auth.json').callback(reject, errReadJson))
		.then(resolve);
});

/**
 * Retrieves a user using their upload token.
 */
export const findFromToken = (token: string) => {
	for (const [uuid, user] of users)
		if (user.token === token)
			return { uuid, user };
	return null;
};

/**
 * Verifies that the upload token in the request exists in the user map
 */
export const verify = (req: Request) => {
	return req.headers.authorization && findFromToken(req.headers.authorization);
};

// todo: This is definitely broken
// Monitor auth.json for changes (triggered by running 'npm run new-token')
fs.watch(path('auth.json'), { persistent: false },
	(eventType: String) => eventType === 'change' && fs.readJson(path('auth.json'))
		.then((json: { users: JSON[] }) => {
			if (!(arrayEquals(Object.keys(users), Object.keys(json.users)))) {
				// @ts-ignore
				Object.keys(json.users).forEach((token) => (!Object.prototype.hasOwnProperty.call(users, token)) && (users[token] = json.users[token]));
				log.info('New token added', Object.keys(users)[Object.keys(users).length - 1] || 'No new token');
			}
		})
		.catch(console.error));
