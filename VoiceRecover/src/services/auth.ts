import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE = 'http://10.180.0.182:8000';

const TOKEN_KEY = 'vr_auth_token';
const USER_KEY  = 'vr_user';

export interface AuthUser {
  user_id: number;
  name: string;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getUser(): Promise<AuthUser | null> {
  const json = await AsyncStorage.getItem(USER_KEY);
  return json ? JSON.parse(json) : null;
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

async function _storeAuth(token: string, user_id: number, name: string): Promise<AuthUser> {
  const user: AuthUser = { user_id, name };
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
  return user;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await axios.post(`${API_BASE}/api/login`, { username, password });
  const { token, user_id, name } = res.data;
  return _storeAuth(token, user_id, name);
}

export async function register(
  username: string,
  password: string,
  name: string,
): Promise<AuthUser> {
  const res = await axios.post(`${API_BASE}/api/register`, { username, password, name });
  const { token, user_id, name: returnedName } = res.data;
  return _storeAuth(token, user_id, returnedName);
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}
