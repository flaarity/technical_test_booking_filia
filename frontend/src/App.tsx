import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";
import { ProtectedApplication, RequireLogin, RoleGuard } from "./components/route-guards";
import { SignInPage } from "./pages/sign-in-page";
import { ForbiddenPage } from "./pages/forbidden-page";
import { UnknownRoute } from "./pages/not-found-page";
import { HomePage } from "./pages/home-page";
import { RoomDetailPage } from "./pages/room-detail-page";
import { PlaceholderPage } from "./pages/placeholder-page";
import { RoomsPage } from "./pages/rooms-page";
import { HistoryPage } from "./pages/history-page";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route element={<RequireLogin />}>
          <Route path="/403" element={<ForbiddenPage />} />
          <Route element={<ProtectedApplication />}>
            <Route index element={<HomePage />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route
              path="rooms/:id"
              element={<RoomDetailPage />}
            />
            <Route
              path="history"
              element={
                <RoleGuard role="WORKER">
                  <HistoryPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/rooms"
              element={
                <RoleGuard role="ADMIN">
                  <PlaceholderPage title="Kelola Ruangan" />
                </RoleGuard>
              }
            />
            <Route
              path="admin/rooms/new"
              element={
                <RoleGuard role="ADMIN">
                  <PlaceholderPage title="Tambah Ruangan" />
                </RoleGuard>
              }
            />
            <Route
              path="admin/rooms/:id/edit"
              element={
                <RoleGuard role="ADMIN">
                  <PlaceholderPage title="Edit Ruangan" />
                </RoleGuard>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<UnknownRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
