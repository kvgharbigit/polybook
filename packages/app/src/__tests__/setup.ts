// Jest setup file for React Native testing

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo modules
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
}));

jest.mock('expo-sqlite', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(),
    exec: jest.fn(),
    close: jest.fn(),
  })),
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

// Mock PDF.js
jest.mock('pdfjs-dist', () => ({
  getDocument: jest.fn(),
  GlobalWorkerOptions: {
    workerSrc: '',
  },
  version: '3.0.279',
}));

// Mock React Native components
jest.mock('react-native-render-html', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ source }: any) => React.createElement('div', {}, source.html || ''),
  };
});

// Mock Zustand
jest.mock('zustand', () => ({
  create: jest.fn((createState) => createState),
}));

// Silence console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};