const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.tsx', 'utf-8');

const target = `  const [assessments, setAssessments] = useState<BuildingAssessment[]>(() => {
    try {`;

const replace = `  const [assessments, setAssessments] = useState<BuildingAssessment[]>(() => {
    try {
      if (!localStorage.getItem('hard_reset_v2')) {
        localStorage.removeItem('sipandu_assessments');
        localStorage.removeItem('sipandu_deleted_assessment_ids');
        localStorage.setItem('hard_reset_v2', 'true');
        return [];
      }
`;

code = code.replace(target, replace);
fs.writeFileSync('src/context/AppContext.tsx', code);
console.log('Done');
