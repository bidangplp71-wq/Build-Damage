const fs = require('fs');

let content = fs.readFileSync('src/services/firebase.ts', 'utf8');

// Replace getFirestore with initializeFirestore
content = content.replace(
  "import { getFirestore, Firestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';",
  "import { getFirestore, initializeFirestore, Firestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';"
);

const oldInit = `    if (firebaseConfig.firestoreDatabaseId) {
      db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    } else {
      db = getFirestore(app);
    }`;

const newInit = `    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    try {
      db = initializeFirestore(app, { experimentalForceLongPolling: true }, dbId);
    } catch (e) {
      // Fallback if already initialized
      db = getFirestore(app, dbId);
    }`;

content = content.replace(oldInit, newInit);

fs.writeFileSync('src/services/firebase.ts', content);
