import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ClientGallery from "./pages/ClientGallery";
import Home from "./pages/Home";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gallery/:id" element={<ClientGallery />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
