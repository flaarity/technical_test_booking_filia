import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { ProtectedApplication, RequireLogin, RoleGuard } from "./components/route-guards";
import { SignInPage } from "./pages/sign-in-page";
import { ForbiddenPage } from "./pages/forbidden-page";
import { UnknownRoute } from "./pages/not-found-page";
import { HomePage } from "./pages/home-page";
import { RoomDetailPage } from "./pages/room-detail-page";
import { RoomsPage } from "./pages/rooms-page";
import { HistoryPage } from "./pages/history-page";
import { AdminRoomsPage } from "./pages/admin-rooms-page";
import { RoomFormPage } from "./pages/room-form-page";
import "./App.css";

const router = createBrowserRouter([
  {
    path: "/sign-in",
    element: <SignInPage />,
  },
  {
    element: <RequireLogin />,
    children: [
      {
        path: "/403",
        element: <ForbiddenPage />,
      },
      {
        element: <ProtectedApplication />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "rooms", element: <RoomsPage /> },
          { path: "rooms/:id", element: <RoomDetailPage /> },
          {
            path: "history",
            element: (
              <RoleGuard role="WORKER">
                <HistoryPage />
              </RoleGuard>
            ),
          },
          {
            path: "admin/rooms",
            element: (
              <RoleGuard role="ADMIN">
                <AdminRoomsPage />
              </RoleGuard>
            ),
          },
          {
            path: "admin/rooms/new",
            element: (
              <RoleGuard role="ADMIN">
                <RoomFormPage mode="create" />
              </RoleGuard>
            ),
          },
          {
            path: "admin/rooms/:id/edit",
            element: (
              <RoleGuard role="ADMIN">
                <RoomFormPage mode="edit" />
              </RoleGuard>
            ),
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <UnknownRoute />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
