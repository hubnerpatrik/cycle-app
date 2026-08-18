import { store } from "./store.js";
import { renderMenuView } from "./views/menu.js";
import { renderProfileScreen } from "./views/profile.js";
import { renderMyMapsView } from "./views/my-maps.js";
import { renderCreateMapView } from "./views/create-map.js";
import { backupFilename } from "./backup.js";

function downloadBackup(contents, mapName) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFilename(new Date(), mapName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createRouter({ root, showStandaloneScreen, openActiveMap, showMessage }) {
  const state = {
    currentScreen: null,
  };

  const navByScreen = {
    menu: "navMenuBtn",
    "my-profile": "navProfileBtn",
    "my-maps": "navMapsBtn",
    "create-map": "navCreateMapBtn",
    "active-map": "navActiveMapBtn",
  };

  function syncHeaderNavigation(screen) {
    const nav = document.getElementById("headerNav");
    if (!nav) return;

    nav.classList.toggle("hidden", screen === "profile-setup");

    Object.entries(navByScreen).forEach(([route, id]) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.classList.toggle("is-active", route === screen);
    });

    const activeMapButton = document.getElementById("navActiveMapBtn");
    if (activeMapButton) {
      activeMapButton.disabled = !store.getActiveMapId();
    }
  }

  function navigate(screen) {
    state.currentScreen = screen;
    render(screen);
  }

  function render(screen) {
    syncHeaderNavigation(screen);

    if (screen !== "active-map") {
      showStandaloneScreen();
    }

    switch (screen) {
      case "profile-setup":
        renderProfileScreen(root, {
          title: "Profile Setup",
          subtitle: "Create your profile before opening the main menu.",
          profile: store.getProfile(),
          submitLabel: "Save and continue",
          showCancel: false,
          onSave: profile => {
            store.saveProfile(profile);
            showMessage?.("Profile saved ✓");
            navigate("menu");
          },
        });
        break;

      case "menu":
        renderMenuView(root, {
          activeMap: store.getMap(store.getActiveMapId()),
          onNavigate: navigate,
        });
        break;

      case "my-profile":
        renderProfileScreen(root, {
          title: "My Profile",
          subtitle: "Update the same values used in the active map sidebar.",
          profile: store.getProfile(),
          submitLabel: "Save profile",
          showCancel: true,
          onCancel: () => navigate("menu"),
          onSave: profile => {
            store.saveProfile(profile);
            showMessage?.("Profile saved ✓");
            navigate("menu");
          },
        });
        break;

      case "my-maps":
        renderMyMapsView(root, {
          maps: store.listMaps(),
          activeMapId: store.getActiveMapId(),
          onCreate: () => navigate("create-map"),
          onImport: async file => {
            let contents;
            try {
              contents = await file.text();
            } catch {
              showMessage?.("The map backup could not be read.");
              return;
            }

            try {
              store.validateMapBackup(contents);
            } catch (error) {
              showMessage?.(error.message || "The map backup is invalid.");
              return;
            }

            if (!confirm("Import this shared map? It will be added to My Maps without changing your profile or existing maps.")) return;

            try {
              const importedMap = store.importMapBackup(contents);
              showMessage?.(`“${importedMap.name || "Untitled map"}” imported ✓`);
              navigate("my-maps");
            } catch (error) {
              showMessage?.(error.message || "Import failed. Your existing data was preserved.");
            }
          },
          onRename: (mapId, name) => {
            const renamed = store.renameMap(mapId, name);
            if (!renamed) {
              showMessage?.("Map name cannot be empty");
              return;
            }
            showMessage?.("Map renamed ✓");
            navigate("my-maps");
          },
          onDelete: mapId => {
            if (!store.deleteMap(mapId)) return;
            showMessage?.("Map deleted");
            navigate("my-maps");
          },
          onExport: mapId => {
            try {
              const map = store.getMap(mapId);
              if (!map) throw new Error("Map not found");
              downloadBackup(store.createMapBackup(mapId), map.name);
              showMessage?.(`“${map.name || "Untitled map"}” exported ✓`);
            } catch {
              showMessage?.("Map export failed. Your data was not changed.");
            }
          },
          onOpen: mapId => {
            store.setActiveMapId(mapId);
            openActiveMap(mapId);
          },
        });
        break;

      case "create-map":
        renderCreateMapView(root, {
          onBack: () => navigate("menu"),
          onCreate: name => {
            const map = store.createMap(name);
            showMessage?.("Map created ✓");
            openActiveMap(map.id);
          },
        });
        break;

      case "active-map":
        openActiveMap(store.getActiveMapId());
        break;

      default:
        navigate(store.hasProfile() ? "menu" : "profile-setup");
        break;
    }
  }

  function start() {
    navigate(store.hasProfile() ? "menu" : "profile-setup");
  }

  return {
    navigate,
    start,
    get currentScreen() {
      return state.currentScreen;
    },
  };
}
