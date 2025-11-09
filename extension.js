// extension.js
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const WORK_TIME = 25 * 60; // 25 minutes in seconds
const SHORT_BREAK = 5 * 60; // 5 minutes
const LONG_BREAK = 15 * 60; // 15 minutes

const PomodoroIndicator = GObject.registerClass(
class PomodoroIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Pomodoro Timer');
        
        // Initialize only primitive state (no objects)
        this._timeLeft = WORK_TIME;
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
        this._timeLeft = WORK_TIME;
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
            if (this._pomodoroCount % 4 === 0) {
                this._timeLeft = LONG_BREAK;
                this._statusItem.label.text = 'Long Break';
            } else {
                this._timeLeft = SHORT_BREAK;
                this._statusItem.label.text = 'Short Break';
            }
            this._isWorkTime = false;
        } else {
            this._timeLeft = WORK_TIME;
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
        
        super.destroy();
    }
});

export default class PomodoroExtension extends Extension {
    enable() {
        this._indicator = new PomodoroIndicator();
        this._indicator.buildUI();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }
    
    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}