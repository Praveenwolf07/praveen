import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, orderBy, Timestamp, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  signInWithPopup, onAuthStateChanged,
  collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, orderBy, Timestamp, getDocs
};
