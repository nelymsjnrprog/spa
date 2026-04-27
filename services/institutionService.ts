import { doc, setDoc, deleteDoc, collection, getDocs, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../core/firebase";

/**
 * Keyword-based student ID validation.
 * 
 * Each institution can have MULTIPLE keyword entries.
 * A student ID is valid if it CONTAINS at least one of the keywords
 * configured for the selected institution (case-insensitive).
 * 
 * Stored in Firestore collection: `institutionConfig`
 * Each document has a unique auto-ID.
 */
export interface Institution {
    id: string;
    name: string;
}

export const institutionService = {
    /**
     * Institutions Management
     */
    async getAllInstitutions(): Promise<Institution[]> {
        const snapshot = await getDocs(collection(db, "institutions"));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Institution))
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    async addInstitution(name: string): Promise<void> {
        const id = Date.now().toString(36);
        await setDoc(doc(db, "institutions", id), { name: name.trim() });
    },

    async deleteInstitution(id: string): Promise<void> {
        await deleteDoc(doc(db, "institutions", id));
    },

    /**
     * Real-time Subscriptions
     */
    subscribeToInstitutions(callback: (institutions: Institution[]) => void) {
        const q = query(collection(db, "institutions"));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Institution));
            const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
            callback(sorted);
        }, (err) => {
            console.error("Institutions subscription error:", err);
            callback([]);
        });
    }
};
