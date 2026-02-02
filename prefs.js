import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PomodoroPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const page = new Adw.PreferencesPage({ title: 'Pomodoro Settings' });
    const durationsGroup = new Adw.PreferencesGroup({ title: 'Duration (minutes)' });
    const othersGroup = new Adw.PreferencesGroup({ title: 'Other settings' });

    // Define rows
    const workDurationRow = new Adw.SpinRow({
      title: 'Work',
      adjustment: new Gtk.Adjustment({ lower: 1, upper: 180, step_increment: 1 }),
    });
    settings.bind('work-minutes', workDurationRow, 'value', Gio.SettingsBindFlags.DEFAULT);

    const shortBreakDurationRow = new Adw.SpinRow({
      title: 'Short break',
      adjustment: new Gtk.Adjustment({ lower: 1, upper: 60, step_increment: 1 }),
    });
    settings.bind('short-break-minutes', shortBreakDurationRow, 'value', Gio.SettingsBindFlags.DEFAULT);

    const longBreakDurationRow = new Adw.SpinRow({
      title: 'Long break',
      adjustment: new Gtk.Adjustment({ lower: 1, upper: 120, step_increment: 1 }),
    });
    settings.bind('long-break-minutes', longBreakDurationRow, 'value', Gio.SettingsBindFlags.DEFAULT);

    const longBreakIntervalRow = new Adw.SpinRow({
      title: 'Long break interval',
      adjustment: new Gtk.Adjustment({ lower: 2, upper: 50, step_increment: 1 }),
    });
    settings.bind('long-break-interval', longBreakIntervalRow, 'value', Gio.SettingsBindFlags.DEFAULT);

    const ResetToDefaultsRow = new Adw.ActionRow({title: 'Reset to default values'});
    ResetToDefaultsRow.activatable = false;
    ResetToDefaultsRow.selectable = false;
    const resetButton = new Gtk.Button({ label: 'Reset' });
    resetButton.add_css_class('destructive-action');
    resetButton.add_css_class('pill');
    resetButton.connect('clicked', () => {
      settings.reset('work-minutes');
      settings.reset('short-break-minutes');
      settings.reset('long-break-minutes');
      settings.reset('long-break-interval');
    });
    ResetToDefaultsRow.add_suffix(resetButton);

    // Assemble the preferences page
    durationsGroup.add(workDurationRow);
    durationsGroup.add(shortBreakDurationRow);
    durationsGroup.add(longBreakDurationRow);
    othersGroup.add(longBreakIntervalRow);
    othersGroup.add(ResetToDefaultsRow)

    page.add(durationsGroup);
    page.add(othersGroup);

    window.add(page);
  }
}

