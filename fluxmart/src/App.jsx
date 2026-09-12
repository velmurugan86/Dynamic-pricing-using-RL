import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Landing from './pages/Landing'
import Shop from './pages/Shop'
import Login from './pages/Login'
import Signup from './pages/Signup'
import PricingLog from './pages/PricingLog'
import ModelInputs from './pages/ModelInputs'
import About from './pages/About'
import Cart from './pages/Cart'
import Orders from './pages/Orders'
import ProtectedRoute from './components/ProtectedRoute'
import { ProductsProvider } from './context/ProductsContext'
import { CartProvider } from './context/CartContext'

export default function App() {
  return (
    <ProductsProvider>
      <CartProvider>
        <div className="min-h-screen flex flex-col bg-brand-cream">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/shop"
                element={
                  <ProtectedRoute>
                    <Shop />
                  </ProtectedRoute>
                }
              />
              <Route path="/cart" element={<Cart />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/about" element={<About />} />
              <Route
                path="/pricing-log"
                element={
                  <ProtectedRoute>
                    <PricingLog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/model-inputs"
                element={
                  <ProtectedRoute>
                    <ModelInputs />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </CartProvider>
    </ProductsProvider>
  )
}
