import fetch from 'isomorphic-fetch';
import jwtDecode from 'jwt-decode';
import { updatePath } from 'redux-simple-router';
import Joi from 'joi';
import {postJSON, parseJSON, hostUrl} from '../../utils/utils';
import socketOptions from '../../utils/socketOptions';
import validateSecretToken from '../../utils/validateSecretToken';

const {authTokenName} = socketOptions;

export const LOGIN_USER_REQUEST = 'LOGIN_USER_REQUEST';
export const LOGIN_USER_ERROR = 'LOGIN_USER_ERROR';
export const LOGIN_USER_SUCCESS = 'LOGIN_USER_SUCCESS';
export const SIGNUP_USER_REQUEST = 'SIGNUP_USER_REQUEST';
export const SIGNUP_USER_ERROR = 'SIGNUP_USER_ERROR';
export const SIGNUP_USER_SUCCESS = 'SIGNUP_USER_SUCCESS';
export const LOGOUT_USER = 'LOGOUT_USER';
export const VERIFY_EMAIL_ERROR = 'VERIFY_EMAIL_ERROR';
export const VERIFY_EMAIL_SUCCESS = 'VERIFY_EMAIL_SUCCESS';

const anyErrors = {
  required: '!!Required',
  empty: '!!Required'
};

export const authSchemaInsert = Joi.object().keys({
  email: Joi.string().email().label('Email').required().options({
    language: {
      any: anyErrors,
      string: {
        email: '!!That\'s not an email!'
      }
    }
  }),
  password: Joi.string().min(6).label('Password').required().options({
    language: {
      any: anyErrors,
      string: {
        min: '{{!key}} should be at least {{limit}} chars long'
      }
    }
  })
});
export const authSchemaEmail = authSchemaInsert.optionalKeys('password');
export const authSchemaPassword = authSchemaInsert.optionalKeys('email');

const initialState = {
  error: {},
  isAuthenticated: false,
  isAuthenticating: false,
  token: null,
  user: {}
};

export default function reducer(state = initialState, action = {}) {
  switch (action.type) {
    case LOGIN_USER_REQUEST:
    case SIGNUP_USER_REQUEST:
      return Object.assign({}, state, {
        error: {},
        isAuthenticating: true
      });
    case LOGIN_USER_SUCCESS:
    case SIGNUP_USER_SUCCESS:
      const {token, user} = action.payload;
      return Object.assign({}, state, {
        error: {},
        isAuthenticating: false,
        isAuthenticated: true,
        token,
        user
      });
    case LOGIN_USER_ERROR:
    case SIGNUP_USER_ERROR:
      return Object.assign({}, state, {
        error: action.error,
        isAuthenticating: false,
        isAuthenticated: false,
        token: null,
        user: {}
      });
    case LOGOUT_USER:
      return Object.assign({}, state, {
        error: {},
        isAuthenticating: false,
        isAuthenticated: false,
        token: null,
        user: {}
      });
    case VERIFY_EMAIL_ERROR:
      return Object.assign({}, state, {
        error: action.error
      });
    case VERIFY_EMAIL_SUCCESS:
      return Object.assign({}, state, {
        user: Object.assign({}, state.user, {
          isVerified: true
        })
      });
    default:
      return state;
  }
}

export function loginUserSuccess(payload) {
  return {
    type: LOGIN_USER_SUCCESS,
    payload
  }
}

export function loginUserError(error) {
  return {
    type: LOGIN_USER_ERROR,
    error
  }
}

export function signupUserSuccess(payload) {
  return {
    type: SIGNUP_USER_SUCCESS,
    payload
  }
}

export function signupUserError(error) {
  return {
    type: SIGNUP_USER_ERROR,
    error
  }
}

export function signupUserRequest() {
  return {
    type: SIGNUP_USER_REQUEST
  }
}


export function loginUser(dispatch, data, redirect) {
  dispatch({type: LOGIN_USER_REQUEST});
  return new Promise(async function (resolve, reject) {
    let res = await postJSON('/auth/login', data);
    let parsedRes = await parseJSON(res);
    const {error, ...payload} = parsedRes;
    if (payload.token) {
      localStorage.setItem(authTokenName, payload.token);
      dispatch(loginUserSuccess(payload));
      dispatch(updatePath(redirect));
      resolve()
    } else {
      dispatch(loginUserError(error));
      reject(error)
    }
  });
}

export function sendResetEmail(data, dispatch) {
  return new Promise(async function (resolve, reject) {
    let res = await postJSON('/auth/send-reset-email', data);
    if (res.status == 200) {
      dispatch(updatePath('/login/reset-email-sent'));
      resolve();
    }
    let parsedRes = await parseJSON(res);
    const {error} = parsedRes;
    if (error) {
      reject(error)
    }

  });
}

export function resetPassword(data, dispatch) {
  return new Promise(async function (resolve, reject) {
    const tokenObject = validateSecretToken(data.resetToken);
    if (tokenObject.error) {
      return reject(tokenObject.error);
    }
    let res = await postJSON('/auth/reset-password', data);
    let parsedRes = await parseJSON(res);
    const {error, ...payload} = parsedRes;
    if (payload.token) {
      localStorage.setItem(authTokenName, payload.token);
      dispatch(signupUserSuccess(payload));
      dispatch(updatePath('/login/reset-password-success'));
      resolve();
    } else {
      reject(error);
    }
  });
}

export function signupUser(dispatch, data, redirect) {
  dispatch(signupUserRequest());
  return new Promise(async function (resolve, reject) {
    let res = await postJSON('/auth/signup', data);
    let parsedRes = await parseJSON(res);
    const {error, ...payload} = parsedRes;
    if (payload.token) {
      localStorage.setItem(authTokenName, payload.token);
      dispatch(signupUserSuccess(payload));
      dispatch(updatePath(redirect));
      resolve();
    } else {
      dispatch(signupUserError(error));
      reject(error);
    }
  });
}

export function loginToken(token) {
  return async function (dispatch) {
    dispatch({type: LOGIN_USER_REQUEST});
    let res = await postJSON('/auth/login-token', {token});
    if (res.status !== 200) {
      localStorage.removeItem(authTokenName);
      return dispatch(loginUserError('Error logging in with token'));
    }
    let parsedRes = await parseJSON(res);
    const payload = {token, user: parsedRes.user};
    dispatch(loginUserSuccess(payload));
  }
}

export function verifyEmail(verifiedToken) {
  return async function (dispatch) {
    let res = await postJSON('/auth/verify-email', {verifiedToken});
    if (res.status === 200) {
      return dispatch({type: VERIFY_EMAIL_SUCCESS});
    }
    let parsedRes = await parseJSON(res);
    return dispatch({
      type: VERIFY_EMAIL_ERROR,
      error: parsedRes.error
    });
  }
}


export function logoutAndRedirect() {
  localStorage.removeItem(authTokenName);
  return function (dispatch) {
    dispatch({type: LOGOUT_USER});
    dispatch(updatePath('/'));
  }
}
