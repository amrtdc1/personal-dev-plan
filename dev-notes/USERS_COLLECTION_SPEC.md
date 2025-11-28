# PDP App — Users Collection & `getUserDoc` Implementation

## Objective

Implement a `users` collection in Firestore and a robust `getUserDoc(uid)` helper in `main.js` that:

- Reads `/users/{uid}`.
- Creates a default user document if it does not exist.
- Returns a plain JS object with basic profile info.
- Integrates safely with the existing `onAuthStateChanged` logic that already calls `getUserDoc(user.uid)`.


## 1. Firestore Rules (already updated in console)

Assume the Firestore rules have been updated to include:

```txt
match /users/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```
Do not modify these rules in code. They are considered correct for this feature.

## 2. Data Model for `users` Collection

Each document in the `users` collection is stored at:
- `users/{uid}`
Where `{uid}` is the Firebase Auth user.uid.

Fields (baseline):
- `email: string | null`
- `displayName: string | null`
- `firstName: string | null`
- `lastName: string | null`
- `createdAt: serverTimestamp`
- `updatedAt: serverTimestamp`

Optional future fields (do NOT implement yet, but keep structure friendly to them):

- `lastLoginAt: serverTimestamp`
- `providerIds: string[]` (e.g., `["password"]`, `["google.com"]`)
- `themePreference: string` (e.g., `"light"` | `"dark"` | `"cwm"`)

## 3. Firestore Imports in `main.js`

In `main.js`, ensure the following Firestore imports are present (using the modular SDK):

```js
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    servertTimestamp
} from "https://www.gstatic.com/firebase/9.23.0/firebase-firestore.js";
```

If `getFirestore` or `db` is already set up, reuse the existing Firestore initialization. Do not create duplicate `db` instances.

## 4. Implement `getUserDoc(uid)` in `main.js`
Implement a helper function `getUserDoc(uid)` in `main.js` (place it near other Firestore helpers). Behavior:
1. Accepts a `uid` (string).
2. Creates a document reference: `const userRef = doc(db, "users", uid);`
3. Attempts to read the documetn with `getDoc(userRef)`.
4. If the document exists:
    - Return `snap.data()` (plain object).
5. If the document does not exist:
    - Read `auth.currentUser` from Firebase Auth.
    - Extract:
        - `email = currentUser?.email || null`
        - `displayName = currentUser?.displayName || null`
    - Create a new document with `setDoc(userRef, { ... })`:
    ```js
    await setDoc(userRef, {
        email,
        displayName,
        firstName: null,
        lastName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    ```
    - After writing, call `getDoc(userRef)` again and return `newSnap.data()`.
6. If any error occurs (permissions, network, etc.):
    - Log: `console.error("Error fetching user doc:", err);`
    - Return null rater than throwing.

Suggested implementation shape:
```js
async function getUserDoc(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      const currentUser = auth.currentUser;
      const email = currentUser?.email || null;
      const displayName = currentUser?.displayName || null;

      await setDoc(userRef, {
        email,
        displayName,
        firstName: null,
        lastName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const newSnap = await getDoc(userRef);
      return newSnap.data();
    }

    return snap.data();
  } catch (err) {
    console.error("Error fetching user doc:", err);
    return null;
  }
}
```
Copilot should generate the final version with correct imports and without duplicating `db` or `auth` definitions.

## 5. Integration with `onAuthStateChanged`
Teh app already has logic similar to:
```js
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUid = user.uid;

    const userDoc = await getUserDoc(user.uid);
    let initial = "";

    if (userDoc && userDoc.firstName) {
      initial = userDoc.firstName[0].toUpperCase();
    } else {
      // Fallback to email first character
      initial = user.email ? user.email[0].toUpperCase() : "U";
    }

    if (userInitial) userInitial.textContent = initial;
    if (userDropdownEmail) userDropdownEmail.textContent = user.email || "";

    // ... rest of the signed-in initialization (load goals, etc.) ...
  } else {
    // ... signed-out behavior ...
  }
});
```
Copilot must:
- Keep the `onAuthStateChanged` structure intact.
- Ensure `getUserDoc` is used exactly as above.
- Ensure that `getUserDoc` does not throw; it should return `null` on failure so the fallback to `user.email[0]` still works.

## 6. Error handling Requirements
- If Firestore rules are correct, there should be no more Missing or insufficient permissions errors related to the users collection.
- If any other error occurs (e.g., network), it should:
    - Log the error via console.error("Error fetching user doc:", err);
    - Allow the rest of the sign-in flow to continue using the email-based fallback for initials.
- The app should never crash or stop loading goals because of a failure to fetch or create the user profile doc.

## 7. Future Extensibility (Do Not Implement Now)

`getUserDoc` shoudl be written in a way that makes it easy to:
- Add a “Profile / Settings” page later that reads and updates:
    - `firstName`, `lastName`
    - Possibly `themePreference` or other user-level settings
- Store additional metadata such as:
    - `lastLoginAt`
    - `providerIds`
- For now, Copilot should only:
    - Implement `getUserDoc(uid)` as described.
    - Ensure it is integrated with the existing `onAuthStateChanged` flow.
    - Ensure imports and Firestore usage are correct.

## 8. Acceptance Criteria
The implementation is considered complete when:
1. A `users` collection appears in Firestore, with a document whose ID matches each signed-in user’s `uid`.
2. Each user document contains at least:
    - `email`
    - `displayName`
    - `firstName` (null initially)
    - `lastName` (null initially)
    - `createdAt`
    - `updatedAt`
3. The console no longer shows `FirebaseError: Missing or insufficient permissions` related to fetching the user doc.
4. The avatar initial behavior works:
Uses `userDoc.firstName[0]` if `firstName` is present.
Falls back to `user.email[0]` if `firstName` is null or `userDoc` is null.
5. Existing functionality for goals, sub-goals, tasks, dashboard, and calendar remains unchanged and continues to work correctly.
