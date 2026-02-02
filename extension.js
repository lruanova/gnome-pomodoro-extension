// extension.js
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';


const PomodoroIndicator = GObject.registerClass(
class PomodoroIndicator extends PanelMenu.Button {
    _init(settings, openPrefs) {
        super._init(0.0, 'Pomodoro Timer');

        this._settings = settings;
        this._openPrefs = openPrefs;
        this._reloadSettings();

        // Initialize only primitive state (no objects)
        this._timeLeft = this._workTime;
        this._isRunning = false;
        this._isWorkTime = true;
        this._pomodoroCount = 0;
        this._timeout = null;
        this._signalIds = [];

    }

    buildUI() {
        // Create panel button label
        this._label = new St.Label({
            text: this._formatTime(this._timeLeft),
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this._label);

        // Create menu items
        this._startStopItem = new PopupMenu.PopupMenuItem('Start');
        const startStopId = this._startStopItem.connect('activate', () => this._toggleTimer());
        this._signalIds.push({obj: this._startStopItem, id: startStopId});
        this.menu.addMenuItem(this._startStopItem);

        this._resetItem = new PopupMenu.PopupMenuItem('Reset');
        const resetId = this._resetItem.connect('activate', () => this._resetTimer());
        this._signalIds.push({obj: this._resetItem, id: resetId});
        this.menu.addMenuItem(this._resetItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._statusItem = new PopupMenu.PopupMenuItem('Work Time', {
            reactive: false
        });
        this.menu.addMenuItem(this._statusItem);

        this._countItem = new PopupMenu.PopupMenuItem('Pomodoros: 0', {
            reactive: false
        });
        this.menu.addMenuItem(this._countItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._prefsItem = new PopupMenu.PopupMenuItem('Preferences');
        const prefsId = this._prefsItem.connect('activate', () => this._openPrefs());
        this._signalIds.push({obj: this._prefsItem, id: prefsId});
        this.menu.addMenuItem(this._prefsItem);
    }

    _reloadSettings() {
      this._workTime = this._settings.get_int('work-minutes') * 60;
      this._shortBreak = this._settings.get_int('short-break-minutes') * 60;
      this._longBreak = this._settings.get_int('long-break-minutes') * 60;
      this._longBreakInterval = this._settings.get_int('long-break-interval');
    }

    connectSettings() {
      this._settingsChangedId = this._settings.connect('changed', () => {
        // Only update the timer if not running and not in the middle of a countdown.
        const prevWork = this._workTime;
        const prevShort = this._shortBreak;
        const prevLong = this._longBreak;

        this._reloadSettings();
        if (this._isRunning)
          return;

        if (this._isWorkTime) {
          if (this._timeLeft === prevWork)
            this._timeLeft = this._workTime;
        } else {
          const label = this._statusItem?.label.text;

          if (label === 'Short Break' && this._timeLeft === prevShort)
            this._timeLeft = this._shortBreak;
          else if (label === 'Long Break' && this._timeLeft === prevLong)
            this._timeLeft = this._longBreak;
        }

        this._label.set_text(this._formatTime(this._timeLeft));
      });
    }


    _formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    _toggleTimer() {
        if (this._isRunning) {
            this._stopTimer();
        } else {
            this._startTimer();
        }
    }

    _startTimer() {
        this._isRunning = true;
        this._startStopItem.label.text = 'Pause';

        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }

        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            if (this._timeLeft > 0) {
                this._timeLeft--;
                this._label.text = this._formatTime(this._timeLeft);
                return GLib.SOURCE_CONTINUE;
            } else {
                this._onTimerComplete();
                return GLib.SOURCE_REMOVE;
            }
        });
    }

    _stopTimer() {
        this._isRunning = false;
        this._startStopItem.label.text = 'Start';

        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
    }

    _resetTimer() {
        this._stopTimer();
        this._isWorkTime = true;
        this._timeLeft = this._workTime;
        this._label.text = this._formatTime(this._timeLeft);
        this._statusItem.label.text = 'Work Time';
    }

    _onTimerComplete() {
        this._isRunning = false;
        this._timeout = null;

        if (this._isWorkTime) {
            this._pomodoroCount++;
            this._countItem.label.text = `Pomodoros: ${this._pomodoroCount}`;

            // Determine break length
            if (this._pomodoroCount % this._longBreakInterval === 0) {
                this._timeLeft = this._longBreak;
                this._statusItem.label.text = 'Long Break';
            } else {
                this._timeLeft = this._shortBreak;
                this._statusItem.label.text = 'Short Break';
            }
            this._isWorkTime = false;
        } else {
            this._timeLeft = this._workTime;
            this._statusItem.label.text = 'Work Time';
            this._isWorkTime = true;
        }

        this._label.text = this._formatTime(this._timeLeft);
        this._startStopItem.label.text = 'Start';

        // Send notification
        Main.notify('Pomodoro Timer',
            this._isWorkTime ? 'Time to work!' : 'Take a break!');
    }

    destroy() {
        // Disconnect all signals
        this._signalIds.forEach(signal => {
            if (signal.obj && signal.id) {
                signal.obj.disconnect(signal.id);
            }
        });
        this._signalIds = [];

        // Remove timeout source
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }

        if (this._settingsChangedId) {
          this._settings.disconnect(this._settingsChangedId);
          this._settingsChangedId = null;
        }

        super.destroy();
    }
});

export default class PomodoroExtension extends Extension {
    enable() {
        const settings = this.getSettings()
        this._indicator = new PomodoroIndicator(settings, () => this.openPreferences());
        this._indicator.buildUI();
        this._indicator.connectSettings();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}