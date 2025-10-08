  // init.js
  // Initialize Firebase for PigSoil+ Web Application

  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js';
  import { getAuth } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
  import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
  import { getStorage } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js';

  // Your Firebase configuration from Firebase Console
  const firebaseConfig = {
    apiKey: "AIzaSyBebdbhEom7To58LFYMkbiI8Buzm7bXOeQ",
    authDomain: "manongcompost.firebaseapp.com",
    projectId: "manongcompost",
    storageBucket: "manongcompost.firebasestorage.app",
    messagingSenderId: "131673559254",
    appId: "1:131673559254:web:b1f2e35ce6cb5c6d21b977"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  // Initialize Firebase services
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  // Export Firebase services for use in other files
  export { auth, db, storage };