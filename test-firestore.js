import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const snap = await getDoc(doc(db, 'system_configs', 'google_sheet'));
    if (snap.exists()) {
      console.log('Firebase google_sheet config doc exists!');
      console.log(JSON.stringify(snap.data(), null, 2));
    } else {
      console.log('Firebase google_sheet config doc DOES NOT EXIST in Firestore!');
    }
  } catch (e) {
    console.error('Error fetching from Firestore:', e);
  }
}

run();
