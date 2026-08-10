import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import HomePage from './pages/HomePage.jsx';
import ArticlePage from './pages/ArticlePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import { appRelativePath } from './app-url.js';

export default function App() {
  const path = appRelativePath();
  const articleMatch = path.match(/^\/artikel\/([^/]+)$/);

  if (path === '/admin') return <AdminPage />;

  return (
    <>
      <Header />
      {articleMatch ? <ArticlePage slug={decodeURIComponent(articleMatch[1])} /> : <HomePage />}
      <Footer />
    </>
  );
}
