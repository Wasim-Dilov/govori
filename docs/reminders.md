# Evening reminders on your iPhone

Govori can nudge you every evening so your streak stays alive. It costs nothing: GitHub sends the reminder from this repository on a schedule, and your phone decides what it says. If you have not practised yet, you get a streak saver. If you already did your lesson, you get a word of the day instead.

You only set this up once. It takes about three minutes.

## 1. Put Govori on your Home Screen

Reminders only work on iPhone when Govori runs as a Home Screen app (iOS 16.4 or newer).

1. Open the Govori link in Safari.
2. Tap the Share button, then **Add to Home Screen**, then **Add**.
3. Close Safari and open Govori from its new icon.

## 2. Turn reminders on in the app

1. In Govori, open **Settings**, then **Reminders**.
2. Tap **Turn on reminders** and allow notifications when iOS asks.
3. Tap **Copy setup code**. The code is a long line of letters and numbers. It belongs to your phone only, so don't share it.

## 3. Give the code to GitHub

1. Tap **Open GitHub** in the app, or go to the repository on github.com, then **Settings**, **Secrets and variables**, **Actions**, **New repository secret**.
2. Name: `GOVORI_PUSH`
3. Secret: paste the setup code.
4. Tap **Add secret**.

GitHub stores the code encrypted. It never appears in the public code.

## 4. Send a test

1. In the repository, open **Actions**, then **Daily reminder**.
2. Tap **Run workflow**, then the green **Run workflow** button.
3. Within a minute your phone should show a Govori notification. A green tick on the run means it was sent.

From now on it arrives every evening by itself.

## Changing the time

The reminder arrives at 19:30 Sofia time all year round. The time lives in `.github/workflows/reminder.yml` in two places:

```yaml
    - cron: '30 16 * * *'
    - cron: '30 17 * * *'
...
          REMINDER_HOUR: '19'
          REMINDER_TZ: Europe/Sofia
```

GitHub's clock is UTC (GMT), and Sofia is 3 hours ahead of UTC in summer and 2 hours ahead in winter. That's why there are two cron lines: GitHub runs both, and Govori only sends from the one that matches the clocks today, so daylight saving never shifts your reminder.

To pick another time:

1. Set `REMINDER_HOUR` to the hour you want in Sofia, for example `'21'` for 21:00.
2. Set the two cron lines to 3 hours and 2 hours earlier than that hour. In a cron line the first number is the minute and the second the hour (UTC). For 21:00 Sofia time use `'0 18 * * *'` and `'0 19 * * *'`.
3. Edit the file on github.com and commit.

If you live in another time zone, change `REMINDER_TZ` (for example `Europe/London`) and use the hours that are your summer and winter difference from UTC. GitHub can start scheduled runs a few minutes late, which is normal. One of the two runs always shows a short "Skipping this run" message in its log. That is expected.

## If reminders stop

- **The run shows a red cross saying the subscription expired.** iOS sometimes resets notification subscriptions, for example after deleting and re-adding the app. In Govori go to Settings, Reminders, turn them off and on again, copy the new code, and replace the `GOVORI_PUSH` secret on GitHub with it.
- **Runs are green but nothing arrives.** Check the iPhone Settings app, under Notifications, Govori, that notifications are allowed, and that a Focus mode is not hiding them.
- **No runs at all.** Open Actions, Daily reminder. If GitHub shows a banner saying the workflow is disabled, tap **Enable workflow**. The workflow re-enables itself every day to prevent this, but it can still happen if it was switched off by hand.
- **You deleted Govori from the Home Screen.** Add it again (step 1) and repeat steps 2 to 4. Your progress lives on the phone, so deleting the app also deletes your progress unless you exported it first.
