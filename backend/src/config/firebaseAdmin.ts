import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const firebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

export const firebaseAdminAuth = getAuth(firebaseApp);