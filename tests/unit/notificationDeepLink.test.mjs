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
