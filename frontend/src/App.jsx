import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import HomePage from './pages/HomePage.jsx';
import ArticlePage from './pages/ArticlePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import { stripAppBaseUrl } from './config.js';

export default function App() {
  const relativePath = stripAppBaseUrl(window.location.pathname);
  const path = relativePath.replace(/\/+$/, '') || '/';
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
