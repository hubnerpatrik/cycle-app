import { store } from "./store.js";
import { renderMenuView } from "./views/menu.js";
import { renderProfileScreen } from "./views/profile.js";
import { renderMyMapsView } from "./views/my-maps.js";
import { renderCreateMapView } from "./views/create-map.js";

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
