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

const Status = {
  ON: 'on',
  OFF: 'off',
  WARNING: 'warning',
  FIRE: 'fire'
};

export default async ({ req, res, log, error }) => {
  try {
    const users = await databases.listDocuments(
      buildingDatabaseID,
      userCollectionID,
      [Query.limit(100000), Query.offset(0)]
    );

    const deviceTokens = users.documents
      .map((document) => document.deviceToken)
      .filter((token) => token !== null && token.trim() !== '');

    log('deviceTokens size: ' + deviceTokens.length);

    const promise = await databases.listDocuments(
      buildingDatabaseID,
      sensorCollectionID,
      [Query.limit(100000), Query.offset(0)]
    );

    const currentDate = new Date();
    log('currentDate: ' + currentDate);
    
    promise.documents.forEach(async (item) => {
      log('-------------- ' + item.name + ' --------------')
      log('lastNotification: ' + item.lastNotification);

      const inputDate = new Date(item.lastNotification);
      log('inputDate: ' + inputDate);

      log('isMoreThan5MinutesAgo: ' + isMoreThan5MinutesAgo(item.lastNotification, currentDate));
      
      if (item.status == Status.FIRE && isMoreThan5MinutesAgo(item.lastNotification, currentDate)) {
        log('Successfully sent message');

        const sendResponse = await sendPushNotification({
          data: {
            title: 'Cảnh báo cháy',
            body:
              'Thiết bị ' +
              item.name +
              ' đang ở mức độ cảnh báo cháy',
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

        const updateResponse = await databases.updateDocument(
          buildingDatabaseID,
          sensorCollectionID,
          item.$id,
          {
            lastNotification: currentDate,
          }
        );
      } else {
        log('Do nothing');
        return ;
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