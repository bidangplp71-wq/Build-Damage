const fs = require('fs');

let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

const oldAssessmentsSync = `    if (db && !isInitialLoad.current) {
      assessments.forEach(a => {
        setDoc(doc(db, 'assessments', a.id), a).catch(console.error);
      });
    }`;

const newAssessmentsSync = `    if (db && !isInitialLoad.current) {
      assessments.forEach(a => {
        // Strip undefined fields for Firebase
        const cleanA = JSON.parse(JSON.stringify(a));
        setDoc(doc(db, 'assessments', cleanA.id), cleanA).catch(console.error);
      });
    }`;

content = content.replace(oldAssessmentsSync, newAssessmentsSync);

const oldUsersSync = `    if (db && !isInitialLoad.current) {
      users.forEach(user => {
        setDoc(doc(db, 'users', user.id), user).catch(console.error);
      });
    }`;

const newUsersSync = `    if (db && !isInitialLoad.current) {
      users.forEach(user => {
        const cleanUser = JSON.parse(JSON.stringify(user));
        setDoc(doc(db, 'users', cleanUser.id), cleanUser).catch(console.error);
      });
    }`;
content = content.replace(oldUsersSync, newUsersSync);

fs.writeFileSync('src/context/AppContext.tsx', content);
