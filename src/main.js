import {
  throwIfMissing,
  sendPushNotification,
  isMoreThan5MinutesAgo,
} from './utils.js';
import { Client, Databases, Query } from 'node-appwrite';
import admin from 'firebase-admin';

throwIfMissing(process.env, [
  'FCM_PROJECT_ID',
  'FCM_PRIVATE_KEY',
  'FCM_CLIENT_EMAIL',
  'APPWRITE_URL',
  'APPWRITE_FUNCTION_PROJECT_ID',
  'SENSOR_COLLECTION_ID',
  'USERS_COLLECTION_ID',
]);

const buildingDatabaseID = process.env.BUILDING_DATABASE_ID;
const sensorCollectionID = process.env.SENSOR_COLLECTION_ID;
const userCollectionID = process.env.USERS_COLLECTION_ID;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FCM_PROJECT_ID,
    clientEmail: process.env.FCM_CLIENT_EMAIL,
    privateKey: process.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  databaseURL: process.env.FCM_DATABASE_URL,
});

const client = new Client()
  .setEndpoint(process.env.APPWRITE_URL)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);
export default async ({ req, res, log, error }) => {
  log('APPWRITE_URL: ' + process.env.APPWRITE_URL
    + '\nAPPWRITE_FUNCTION_PROJECT_ID: ' + process.env.APPWRITE_FUNCTION_PROJECT_ID
    + '\nBUILDING_DATABASE_ID: ' + process.env.BUILDING_DATABASE_ID
    + '\nSENSOR_COLLECTION_ID: ' + process.env.SENSOR_COLLECTION_ID
    + '\nUSERS_COLLECTION_ID: ' + process.env.USERS_COLLECTION_ID
  );

  try {
    const users = await databases.listDocuments(
      buildingDatabaseID,
      userCollectionID,
      [Query.limit(100000), Query.offset(0)]
    );

    const deviceTokens = users.documents
      .map((document) => document.deviceToken)
      .filter((token) => token !== null && token.trim() !== '');

    const promise = await databases.listDocuments(
      buildingDatabaseID,
      sensorCollectionID,
      [Query.limit(100000), Query.offset(0)]
    );

    promise.documents.forEach(async (item) => {
      const currentDate = new Date();
      if (
        item.value >= 1000 &&
        isMoreThan5MinutesAgo(item.lastNotification, currentDate)
      ) {
        const sendResponse = await sendPushNotification({
          data: {
            title: 'Cảnh báo cháy',
            body:
              'Thiết bị ' +
              item.name +
              ' đang ở mức độ cảnh báo cháy (' +
              item.value +
              ')',
            "$id": String(item.$id),
            "name": String(item.name),
            "time": String(item.time),
            "timeTurnOn": String(item.timeTurnOn),
            "battery": String(item.battery),
            "type": String(item.type),
            "value": String(item.value),
            "status": String(item.status),
          },
          tokens: deviceTokens,
        });

        log('Successfully sent message: ', sendResponse);

        const updateResponse = await databases.updateDocument(
          buildingDatabaseID,
          sensorCollectionID,
          item.$id,
          {
            lastNotification: currentDate,
          }
        );
      }
    });
  } catch (e) {
    error('Errors:' + e);
  }

  return res.json({
    message:
      'Start testing the realtime read senor value and push notification function',
  });
};