import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Note: I can't easily run a firebase script here without the credentials in process.env, which are available but maybe easier to just let the user delete it.
