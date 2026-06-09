import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Create from "@/pages/Create";
import Generating from "@/pages/Generating";
import Book from "@/pages/Book";
import Puzzle from "@/pages/Puzzle";
import Coloring from "@/pages/Coloring";

import MatchGame from "@/pages/MatchGame";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<Create />} />
        <Route path="/generating" element={<Generating />} />
        <Route path="/book" element={<Book />} />
        <Route path="/puzzle" element={<Puzzle />} />
        <Route path="/coloring" element={<Coloring />} />
        <Route path="/match" element={<MatchGame />} />
      </Routes>
    </Router>
  );
}
