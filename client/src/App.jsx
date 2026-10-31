// Every page and who can see it.
//   Public:          /  /games  /games/:id  /posts/:id  /about  /services  /contact  /login
//   Signed in:       /posts/new  /posts/:id/edit  /dashboard  /profile
//   Admin (Jah):     /admin/dashboard  /admin/games/new  /admin/games/:id/edit
//   Admin sign-in:   /admin/login (not linked anywhere; bookmark it)
// The server checks every request again, so these guards are for showing the
// right page, not for security.
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { RequireAdmin, RequireAuth } from "./auth/guards.jsx";
import Home from "./pages/Home.jsx";
import Games from "./pages/Games.jsx";
import GameDetail from "./pages/GameDetail.jsx";
import PostDetail from "./pages/PostDetail.jsx";
import PostEditor from "./pages/PostEditor.jsx";
import About from "./pages/About.jsx";
import Services from "./pages/Services.jsx";
import Login from "./pages/Login.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import GameEditor from "./pages/GameEditor.jsx";
import NotFound from "./pages/NotFound.jsx";
import Profile from "./pages/Profile.jsx";
import Contact from "./pages/Contact.jsx";

// The route tester only exists while developing (npm run dev). `npm run build`
// leaves it out of the real site completely.
const DevTest = import.meta.env.DEV ? lazy(() => import("./devtest/DevTest.jsx")) : null;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="games" element={<Games />} />
        <Route path="games/:id" element={<GameDetail />} />
        <Route path="posts/new" element={<RequireAuth><PostEditor /></RequireAuth>} />
        <Route path="posts/:id" element={<PostDetail />} />
        <Route path="posts/:id/edit" element={<RequireAuth><PostEditor /></RequireAuth>} />
        <Route path="about" element={<About />} />
        <Route path="services" element={<Services />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login />} />
        <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="admin/dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="admin/games/new" element={<RequireAdmin><GameEditor /></RequireAdmin>} />
        <Route path="admin/games/:id/edit" element={<RequireAdmin><GameEditor /></RequireAdmin>} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {DevTest && (
        <Route
          path="dev/routes"
          element={
            <Suspense fallback={null}>
              <DevTest />
            </Suspense>
          }
        />
      )}
    </Routes>
  );
}
