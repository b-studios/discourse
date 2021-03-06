import showModal from 'discourse/lib/show-modal';

const LOG_CHANNEL = "/admin/backups/logs";

export default Discourse.Route.extend({

  activate() {
    this.messageBus.subscribe(LOG_CHANNEL, this._processLogMessage.bind(this));
  },

  _processLogMessage(log) {
    if (log.message === "[STARTED]") {
      this.controllerFor("adminBackups").set("model.isOperationRunning", true);
      this.controllerFor("adminBackupsLogs").clear();
    } else if (log.message === "[FAILED]") {
      this.controllerFor("adminBackups").set("model.isOperationRunning", false);
      bootbox.alert(I18n.t("admin.backups.operations.failed", { operation: log.operation }));
    } else if (log.message === "[SUCCESS]") {
      Discourse.User.currentProp("hideReadOnlyAlert", false);
      this.controllerFor("adminBackups").set("model.isOperationRunning", false);
      if (log.operation === "restore") {
        // redirect to homepage when the restore is done (session might be lost)
        window.location.pathname = Discourse.getURL("/");
      }
    } else {
      this.controllerFor("adminBackupsLogs").pushObject(Em.Object.create(log));
    }
  },

  model() {
    return PreloadStore.getAndRemove("operations_status", function() {
      return Discourse.ajax("/admin/backups/status.json");
    }).then(status => {
      return Discourse.BackupStatus.create({
        isOperationRunning: status.is_operation_running,
        canRollback: status.can_rollback,
        allowRestore: status.allow_restore
      });
    });
  },

  deactivate() {
    this.messageBus.unsubscribe(LOG_CHANNEL);
  },

  actions: {
    startBackup() {
      showModal('modals/admin-start-backup');
      this.controllerFor('modal').set('modalClass', 'start-backup-modal');
    },

    backupStarted() {
      this.controllerFor("adminBackups").set("isOperationRunning", true);
      this.transitionTo("admin.backups.logs");
      this.send("closeModal");
    },

    destroyBackup(backup) {
      const self = this;
      bootbox.confirm(
        I18n.t("admin.backups.operations.destroy.confirm"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) {
            backup.destroy().then(function() {
              self.controllerFor("adminBackupsIndex").removeObject(backup);
            });
          }
        }
      );
    },

    startRestore(backup) {
      const self = this;
      bootbox.confirm(
        I18n.t("admin.backups.operations.restore.confirm"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) {
            Discourse.User.currentProp("hideReadOnlyAlert", true);
            backup.restore().then(function() {
              self.controllerFor("adminBackupsLogs").clear();
              self.controllerFor("adminBackups").set("model.isOperationRunning", true);
              self.transitionTo("admin.backups.logs");
            });
          }
        }
      );
    },

    cancelOperation() {
      const self = this;
      bootbox.confirm(
        I18n.t("admin.backups.operations.cancel.confirm"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) {
            Discourse.Backup.cancel().then(function() {
              self.controllerFor("adminBackups").set("model.isOperationRunning", false);
            });
          }
        }
      );
    },

    rollback() {
      bootbox.confirm(
        I18n.t("admin.backups.operations.rollback.confirm"),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) { Discourse.Backup.rollback(); }
        }
      );
    },

    uploadSuccess(filename) {
      const self = this;
      bootbox.alert(I18n.t("admin.backups.upload.success", { filename: filename }), function() {
        Discourse.Backup.find().then(function (backups) {
          self.controllerFor("adminBackupsIndex").set("model", backups);
        });
      });
    },

    uploadError(filename, message) {
      bootbox.alert(I18n.t("admin.backups.upload.error", { filename: filename, message: message }));
    }
  }
});
