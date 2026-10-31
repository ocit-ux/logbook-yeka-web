import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseNotificationResponseAction,
  setupNotificationResponseReceivedListener,
  checkInitialNotificationResponseAsync,
  scheduleDailyReminder,
  setNotificationAdapter,
  getNotificationAdapter
} from '../../apps/mobile/src/utils/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

test('Typography Integrity: zero em dashes across notification implementation and test files', () => {
  const notifSourcePath = path.join(rootDir, 'apps/mobile/src/utils/notifications.js');
  const notifSource = fs.readFileSync(notifSourcePath, 'utf8');
  assert.strictEqual(
    notifSource.includes('\u2014'),
    false,
    'apps/mobile/src/utils/notifications.js must contain zero em dashes'
  );

  const testSource = fs.readFileSync(__filename, 'utf8');
  assert.strictEqual(
    testSource.includes('\u2014'),
    false,
    'tests/unit/notificationDeepLink.test.mjs must contain zero em dashes'
  );
});

test('parseNotificationResponseAction: extracts action open_journal from action: open_journal', () => {
  const response = {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      request: {
        content: {
          title: 'Pengingat: Pengisian Jurnal Harian',
          body: 'Mohon lengkapi jurnal kegiatan kerja Anda hari ini.',
          data: {
            action: 'open_journal',
            timestamp: Date.now()
          }
        }
      }
    }
  };

  const action = parseNotificationResponseAction(response);
  assert.strictEqual(action, 'open_journal');
});

test('parseNotificationResponseAction: extracts action open_journal from type: local_daily_reminder', () => {
  const response = {
    notification: {
      request: {
        content: {
          title: 'Pengingat',
          data: {
            type: 'local_daily_reminder'
          }
        }
      }
    }
  };

  const action = parseNotificationResponseAction(response);
  assert.strictEqual(action, 'open_journal');
});

test('parseNotificationResponseAction: extracts action open_journal from type: server_daily_reminder', () => {
  const response = {
    notification: {
      request: {
        content: {
          data: {
            type: 'server_daily_reminder'
          }
        }
      }
    }
  };

  const action = parseNotificationResponseAction(response);
  assert.strictEqual(action, 'open_journal');
});

test('parseNotificationResponseAction: extracts open_journal when both action and type are provided', () => {
  const response = {
    notification: {
      request: {
        content: {
          data: {
            type: 'server_daily_reminder',
            action: 'open_journal'
          }
        }
      }
    }
  };

  const action = parseNotificationResponseAction(response);
  assert.strictEqual(action, 'open_journal');
});

test('parseNotificationResponseAction: supports direct data property on response', () => {
  const response = {
    data: {
      action: 'open_journal'
    }
  };

  const action = parseNotificationResponseAction(response);
  assert.strictEqual(action, 'open_journal');
});

test('parseNotificationResponseAction: extracts action open_journal from bare payload objects', () => {
  assert.strictEqual(parseNotificationResponseAction({ action: 'open_journal' }), 'open_journal');
  assert.strictEqual(parseNotificationResponseAction({ type: 'local_daily_reminder' }), 'open_journal');
  assert.strictEqual(parseNotificationResponseAction({ type: 'server_daily_reminder' }), 'open_journal');
});

test('parseNotificationResponseAction: returns null for unhandled, malformed, or empty responses', () => {
  assert.strictEqual(parseNotificationResponseAction(null), null);
  assert.strictEqual(parseNotificationResponseAction(undefined), null);
  assert.strictEqual(parseNotificationResponseAction({}), null);
  assert.strictEqual(parseNotificationResponseAction({ notification: {} }), null);
  assert.strictEqual(parseNotificationResponseAction({ notification: { request: {} } }), null);
  assert.strictEqual(parseNotificationResponseAction({ notification: { request: { content: {} } } }), null);
  assert.strictEqual(parseNotificationResponseAction({ notification: { request: { content: { data: {} } } } }), null);
  assert.strictEqual(
    parseNotificationResponseAction({
      notification: {
        request: {
          content: {
            data: {
              type: 'general_announcement',
              action: 'open_news'
            }
          }
        }
      }
    }),
    null
  );
});

test('setupNotificationResponseReceivedListener: gracefully no-ops on web and headless environments', () => {
  setNotificationAdapter({
    Platform: { OS: 'web' },
    Notifications: null
  });

  const listener = setupNotificationResponseReceivedListener((action) => {
    assert.fail('Should not trigger in web environment');
  });

  assert.ok(listener, 'Listener object must be returned');
  assert.strictEqual(typeof listener.remove, 'function', 'remove() method must be a callable function');
  assert.doesNotThrow(() => listener.remove(), 'remove() must not throw');
});

test('setupNotificationResponseReceivedListener: registers listener and dispatches parsed action on response', () => {
  let registeredCallback = null;
  let subscriptionRemoved = false;

  const mockSubscription = {
    remove: () => {
      subscriptionRemoved = true;
    }
  };

  const mockNotifications = {
    addNotificationResponseReceivedListener: (callback) => {
      registeredCallback = callback;
      return mockSubscription;
    }
  };

  setNotificationAdapter({
    Platform: { OS: 'android' },
    Notifications: mockNotifications
  });

  let dispatchedAction = null;
  let dispatchedResponse = null;

  const handle = setupNotificationResponseReceivedListener((action, resp) => {
    dispatchedAction = action;
    dispatchedResponse = resp;
  });

  assert.strictEqual(typeof registeredCallback, 'function', 'Listener callback must be registered');

  // Trigger with actionable response
  const mockResponse = {
    notification: {
      request: {
        content: {
          data: {
            action: 'open_journal'
          }
        }
      }
    }
  };

  registeredCallback(mockResponse);
  assert.strictEqual(dispatchedAction, 'open_journal');
  assert.deepStrictEqual(dispatchedResponse, mockResponse);

  // Trigger with non-actionable response (should not overwrite or trigger)
  dispatchedAction = null;
  registeredCallback({ notification: { request: { content: { data: { type: 'unknown' } } } } });
  assert.strictEqual(dispatchedAction, null, 'Unhandled actions must not trigger callback');

  // Verify unsubscribe
  handle.remove();
  assert.strictEqual(subscriptionRemoved, true, 'Subscription remove() must be invoked');
});

test('checkInitialNotificationResponseAsync: returns null on web or missing getLastNotificationResponseAsync', async () => {
  setNotificationAdapter({
    Platform: { OS: 'web' },
    Notifications: null
  });

  const actionOnWeb = await checkInitialNotificationResponseAsync();
  assert.strictEqual(actionOnWeb, null);

  setNotificationAdapter({
    Platform: { OS: 'android' },
    Notifications: {}
  });

  const actionNoMethod = await checkInitialNotificationResponseAsync();
  assert.strictEqual(actionNoMethod, null);
});

test('checkInitialNotificationResponseAsync: resolves cold-start notification response action', async () => {
  const mockResponse = {
    notification: {
      request: {
        content: {
          data: {
            type: 'server_daily_reminder'
          }
        }
      }
    }
  };

  setNotificationAdapter({
    Platform: { OS: 'android' },
    Notifications: {
      getLastNotificationResponseAsync: async () => mockResponse
    }
  });

  const action = await checkInitialNotificationResponseAsync();
  assert.strictEqual(action, 'open_journal');

  // Cold-start with no launching notification
  setNotificationAdapter({
    Platform: { OS: 'android' },
    Notifications: {
      getLastNotificationResponseAsync: async () => null
    }
  });

  const noAction = await checkInitialNotificationResponseAsync();
  assert.strictEqual(noAction, null);
});

test('checkInitialNotificationResponseAsync: safely catches error if getLastNotificationResponseAsync throws', async () => {
  setNotificationAdapter({
    Platform: { OS: 'android' },
    Notifications: {
      getLastNotificationResponseAsync: async () => {
        throw new Error('Native notification service unavailable');
      }
    }
  });

  const action = await checkInitialNotificationResponseAsync();
  assert.strictEqual(action, null);
});

test('scheduleDailyReminder: includes action: open_journal in scheduled payload data', async () => {
  let scheduledPayload = null;
  let cancelledAll = false;

  const mockNotifications = {
    cancelAllScheduledNotificationsAsync: async () => {
      cancelledAll = true;
    },
    scheduleNotificationAsync: async (options) => {
      scheduledPayload = options;
    }
  };

  setNotificationAdapter({
    Platform: { OS: 'android' },
    Notifications: mockNotifications
  });

  await scheduleDailyReminder();

  assert.strictEqual(cancelledAll, true, 'cancelAllScheduledNotificationsAsync must be called');
  assert.ok(scheduledPayload, 'scheduleNotificationAsync must receive payload');
  assert.strictEqual(
    scheduledPayload.content?.data?.action,
    'open_journal',
    'Payload content.data must contain action: open_journal'
  );
  assert.strictEqual(
    scheduledPayload.content?.data?.type,
    'local_daily_reminder',
    'Payload content.data must preserve type: local_daily_reminder'
  );
});

test('App.js static contract: imports setupNotificationResponseReceivedListener and checkInitialNotificationResponseAsync', () => {
  const appJsPath = path.join(rootDir, 'apps/mobile/App.js');
  const appSource = fs.readFileSync(appJsPath, 'utf8');

  assert.match(
    appSource,
    /import\s*\{[^}]*setupNotificationResponseReceivedListener[^}]*\}\s*from\s*['"]\.\/src\/utils\/notifications['"]/,
    'App.js must import setupNotificationResponseReceivedListener from ./src/utils/notifications'
  );
  assert.match(
    appSource,
    /import\s*\{[^}]*checkInitialNotificationResponseAsync[^}]*\}\s*from\s*['"]\.\/src\/utils\/notifications['"]/,
    'App.js must import checkInitialNotificationResponseAsync from ./src/utils/notifications'
  );
});

test('App.js static contract: manages pendingNotificationAction and userRef state', () => {
  const appJsPath = path.join(rootDir, 'apps/mobile/App.js');
  const appSource = fs.readFileSync(appJsPath, 'utf8');

  assert.match(
    appSource,
    /pendingNotificationAction/i,
    'App.js must define or manage pendingNotificationAction'
  );
  assert.match(
    appSource,
    /setPendingNotificationAction/,
    'App.js must define setPendingNotificationAction state setter'
  );
  assert.match(
    appSource,
    /userRef/,
    'App.js must maintain userRef to safely inspect auth state inside listener closures'
  );
});

test('App.js static contract: routes to home when open_journal is received or queues if unauthenticated', () => {
  const appJsPath = path.join(rootDir, 'apps/mobile/App.js');
  const appSource = fs.readFileSync(appJsPath, 'utf8');

  assert.match(
    appSource,
    /setupNotificationResponseReceivedListener\s*\(/,
    'App.js must register setupNotificationResponseReceivedListener'
  );
  assert.match(
    appSource,
    /checkInitialNotificationResponseAsync\s*\(/,
    'App.js must inspect cold-start initial notification via checkInitialNotificationResponseAsync'
  );
  assert.match(
    appSource,
    /open_journal/,
    'App.js must check for open_journal notification action'
  );
  assert.match(
    appSource,
    /setActiveTab\(\s*['"]home['"]\s*\)/,
    'App.js must switch activeTab to home on notification response'
  );
});

test('App.js static contract: handleLoginSuccess resolves pendingNotificationAction and routes to home', () => {
  const appJsPath = path.join(rootDir, 'apps/mobile/App.js');
  const appSource = fs.readFileSync(appJsPath, 'utf8');

  assert.match(
    appSource,
    /handleLoginSuccess/,
    'App.js must define handleLoginSuccess'
  );
  assert.match(
    appSource,
    /setPendingNotificationAction\(\s*null\s*\)/,
    'App.js must reset pendingNotificationAction to null once consumed'
  );
});

test('Typography Integrity: zero em dashes across App.js', () => {
  const appJsPath = path.join(rootDir, 'apps/mobile/App.js');
  const appSource = fs.readFileSync(appJsPath, 'utf8');
  assert.strictEqual(
    appSource.includes('\u2014'),
    false,
    'apps/mobile/App.js must contain zero em dashes'
  );
});

test('Deep link simulation: unauthenticated intent is queued and executed upon successful login', () => {
  let activeTab = 'profile';
  let currentUser = null;
  let pendingNotificationAction = null;

  const simulateNotificationAction = (action) => {
    if (action === 'open_journal') {
      if (currentUser) {
        activeTab = 'home';
      } else {
        pendingNotificationAction = action;
      }
    }
  };

  const simulateLoginSuccess = (user) => {
    currentUser = user;
    if (pendingNotificationAction === 'open_journal') {
      activeTab = 'home';
      pendingNotificationAction = null;
    }
  };

  // 1. Notification received while unauthenticated
  simulateNotificationAction('open_journal');
  assert.strictEqual(activeTab, 'profile', 'Tab should not change while unauthenticated');
  assert.strictEqual(pendingNotificationAction, 'open_journal', 'Intent must be queued');

  // 2. User logs in successfully
  simulateLoginSuccess({ username: 'guru1', role: 'guru' });
  assert.strictEqual(activeTab, 'home', 'Tab must transition to home after login');
  assert.strictEqual(pendingNotificationAction, null, 'Pending action must be cleared');

  // 3. Notification received while already authenticated
  activeTab = 'history';
  simulateNotificationAction('open_journal');
  assert.strictEqual(activeTab, 'home', 'Tab must immediately switch to home when authenticated');
  assert.strictEqual(pendingNotificationAction, null, 'No pending action when already authenticated');
});
