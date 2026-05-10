const { onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require('firebase-admin');
admin.initializeApp();

// Set global options to us-central1
setGlobalOptions({ region: "us-central1" });

/**
 * Cloud Function (2nd Gen) to permanently delete a user account from Firebase Auth.
 * This triggers the "Delete User Data" extension.
 * 
 * We set invoker: "public" to allow the Firebase SDK to call this function 
 * without Cloud Run blocking it at the IAM level. Internal Auth check still applies.
 */
exports.deleteUserAccount = onCall(
  { invoker: "public" }, 
  async (request) => {
    // 1. Security Check: Must be authenticated via Firebase Auth
    if (!request.auth) {
      throw new Error("unauthenticated: You must be logged in.");
    }

    // 2. Security Check: Must be an admin
    const callerUid = request.auth.uid;
    const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
    const callerData = callerDoc.data();

    if (!callerData || callerData.role !== 'admin') {
      throw new Error("permission-denied: Only administrators can delete accounts.");
    }

    const targetUid = request.data.uid;
    if (!targetUid) {
      throw new Error("invalid-argument: Target user UID is required.");
    }

    try {
      // 3. Delete from Firebase Auth (This triggers the Extension)
      await admin.auth().deleteUser(targetUid);
      return { success: true };
    } catch (error) {
      console.error("Deletion failed for UID:", targetUid, error);
      throw new Error("internal: " + error.message);
    }
  }
);
