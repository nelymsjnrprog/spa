import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./core/firebase";

async function diagnoseLevels() {
  const q = query(collection(db, "users"), where("role", "==", "student"));
  const snapshot = await getDocs(q);
  
  const stats = {
    total: snapshot.size,
    byLevel: {} as Record<string, number>,
    missingLevel: 0
  };

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.level) {
      stats.byLevel[data.level] = (stats.byLevel[data.level] || 0) + 1;
    } else {
      stats.missingLevel++;
    }
  });

  console.log("Student Level Diagnostics:", JSON.stringify(stats, null, 2));
}

diagnoseLevels();
