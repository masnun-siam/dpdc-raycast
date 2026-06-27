// Minimal mock of @raycast/api for Jest — only what our lib code uses
const store: Record<string, string> = {};

export const LocalStorage = {
  getItem: jest.fn(async <T = string>(key: string): Promise<T | undefined> => {
    const val = store[key];
    return val as T | undefined;
  }),
  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    store[key] = value;
  }),
  removeItem: jest.fn(async (key: string): Promise<void> => {
    delete store[key];
  }),
  clear: jest.fn(async (): Promise<void> => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
};

export const getPreferenceValues = jest.fn(() => ({
  alertThreshold: "50",
  refreshInterval: "30",
}));

export const showToast = jest.fn();
export const showHUD = jest.fn();
export const launchCommand = jest.fn();
export const open = jest.fn();
export const Clipboard = { copy: jest.fn() };
export const Icon = { Star: "star", Circle: "circle" };
export const Color = { Green: "#00aa00", Orange: "#ff8800", Red: "#ff0000" };
export const Toast = { Style: { Success: "success", Failure: "failure", Animated: "animated" } };

export const resetMockStore = () => {
  Object.keys(store).forEach((k) => delete store[k]);
  jest.clearAllMocks();
};
