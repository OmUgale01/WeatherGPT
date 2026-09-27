import { useEffect, useState } from "react";

import Home from "./pages/Home";
import Auth from "./pages/Auth";

import { supabase } from "./lib/supabaseClient";

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <main className="location-screen">
        <div className="location-card">
          <h1>WeatherGPT</h1>
          <p>Checking your account...</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return <Home />;
}

export default App;