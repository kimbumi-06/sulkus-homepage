import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

/**
 * 로그인 상태 + 운영진 여부.
 * 운영진 판별은 Firestore의 config/admins 문서를 읽을 수 있는지로 한다.
 * (보안 규칙이 운영진 이메일만 읽기를 허용하므로, 화면 쪽 검사를 우회해도 데이터는 못 본다)
 *
 * status: 'loading' | 'signedOut' | 'denied' | 'admin'
 */
export function useAdminAuth() {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ status: 'signedOut', user: null });
        return;
      }
      try {
        await getDoc(doc(db, 'config', 'admins'));
        setState({ status: 'admin', user });
      } catch {
        setState({ status: 'denied', user });
      }
    });
  }, []);

  return {
    ...state,
    signIn: () => signInWithPopup(auth, googleProvider),
    signOut: () => signOut(auth),
  };
}
