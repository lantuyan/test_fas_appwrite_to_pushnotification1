import admin from 'firebase-admin';
import { Client, Databases, Query } from 'node-appwrite';

throwIfMissing(process.env, [
  'FCM_PROJECT_ID',
  'FCM_PRIVATE_KEY',
  'FCM_CLIENT_EMAIL',
  'FCM_DATABASE_URL',
]);

/**
 * Throws an error if any of the keys are missing from the object
 * @param {*} obj
 * @param {string[]} keys
 * @throws {Error}
 */
export function throwIfMissing(obj, keys) {
  const missing = [];
  for (let key of keys) {
    if (!(key in obj) || !obj[key]) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * @param {admin.messaging.Message} payload
 * @returns {Promise<string>}
 */
export async function sendPushNotification(payload) {
  try {
    return await admin.messaging().sendMulticast(payload);
  } catch (e) {
    throw 'error on messaging ';
  }
}

export function isMoreThan5MinutesAgo(dateString, currentDate) {
  if (!dateString) {
    return true;
  }

  const inputDate = new Date(dateString);

  const timeDifference = currentDate - inputDate;
  const fiveMinutesInMilliseconds = 5 * 60 * 1000;

  // So sánh sự chênh lệch với 5 phút
  return timeDifference > fiveMinutesInMilliseconds;
}