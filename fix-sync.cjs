const fs = require('fs');

let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

// Replace the bad hook
const oldHook = `
  // Sync logic for Firebase
  useEffect(() => {
    if (!db) return;
    
    // Load and sync users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      if (!snapshot.empty) {
        const fbUsers = snapshot.docs.map(doc => doc.data() as UserAccount);
        setUsers(fbUsers);
      }
    });

    // Load and sync assessments
    const unsubAssessments = onSnapshot(collection(db, 'assessments'), (snapshot) => {
      if (!snapshot.empty) {
        const fbAssessments = snapshot.docs.map(doc => doc.data() as BuildingAssessment);
        setAssessments(fbAssessments);
      }
    });

    return () => {
      unsubUsers();
      unsubAssessments();
    };
  }, []);

  // Update Firebase when users changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (db && users.length > 0) {
      users.forEach(user => {
        setDoc(doc(db, 'users', user.id), user).catch(console.error);
      });
    }
  }, [users]);

  // Update Firebase when assessments changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(assessments));
    if (db && assessments.length > 0) {
      assessments.forEach(a => {
        setDoc(doc(db, 'assessments', a.id), a).catch(console.error);
      });
    }
  }, [assessments]);
`;

const correctHook = `
  const isInitialLoad = React.useRef(true);
  
  // Load from Firebase ONCE on mount
  useEffect(() => {
    if (!db) return;
    
    getDocs(collection(db, 'users')).then((snapshot) => {
      if (!snapshot.empty) {
        setUsers(snapshot.docs.map(doc => doc.data() as UserAccount));
      } else {
        // If empty, seed with INITIAL_USERS
        INITIAL_USERS.forEach(u => setDoc(doc(db, 'users', u.id), u));
      }
    });

    getDocs(collection(db, 'assessments')).then((snapshot) => {
      if (!snapshot.empty) {
        setAssessments(snapshot.docs.map(doc => doc.data() as BuildingAssessment));
      } else {
        INITIAL_ASSESSMENTS.forEach(a => setDoc(doc(db, 'assessments', a.id), a));
      }
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    if (db && !isInitialLoad.current) {
      users.forEach(user => {
        setDoc(doc(db, 'users', user.id), user).catch(console.error);
      });
    }
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(assessments));
    if (db && !isInitialLoad.current) {
      assessments.forEach(a => {
        setDoc(doc(db, 'assessments', a.id), a).catch(console.error);
      });
    }
  }, [assessments]);

  useEffect(() => {
    const timer = setTimeout(() => { isInitialLoad.current = false; }, 2000);
    return () => clearTimeout(timer);
  }, []);
`;

content = content.replace(oldHook, correctHook);

// wait, I also need to make sure deleteDoc is called when we delete.
// Let's modify deleteAssessment and deleteUser functions in the script.

content = content.replace(
  "setUsers((prev) => prev.filter((u) => u.id !== id));",
  "if (db) { import('firebase/firestore').then(({ deleteDoc, doc }) => deleteDoc(doc(db, 'users', id))).catch(console.error); }; setUsers((prev) => prev.filter((u) => u.id !== id));"
);

content = content.replace(
  "setAssessments((prev) => prev.filter((a) => a.id !== id));",
  "if (db) { import('firebase/firestore').then(({ deleteDoc, doc }) => deleteDoc(doc(db, 'assessments', id))).catch(console.error); }; setAssessments((prev) => prev.filter((a) => a.id !== id));"
);

fs.writeFileSync('src/context/AppContext.tsx', content);
