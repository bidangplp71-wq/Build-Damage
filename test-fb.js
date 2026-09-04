import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import config from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

getDocs(collection(db, 'system_health')).then(() => {
  console.log('Success');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
