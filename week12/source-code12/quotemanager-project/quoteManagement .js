//CRUD on quotes
import { getItems } from "./myLib/fetchUils.js"

//GET Quotes
async function loadQuotes() {
  try {
    const quotes = await getItems(`${import.meta.env.VITE_APP_URL}/quotes`)
    console.log(quotes)
    return quotes
  } catch (error) {
    alert(error)
  }
}

//Create Quote
async function createQuote(content, author) {
  try {
    const res = await fetch(`${import.meta.env.VITE_APP_URL}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, author }),
    })
    if (!res.ok) throw new Error("Failed to create quote")
    const newQuote = await res.json()
    return newQuote
  } catch (error) {
    alert(error)
  }
}

//Edit Quote
async function editQuote(id, content, author) {
  try {
    const res = await fetch(`${import.meta.env.VITE_APP_URL}/quotes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, author }),
    })
    if (!res.ok) throw new Error("Failed to update quote")
    const updatedQuote = await res.json()
    return updatedQuote
  } catch (error) {
    alert(error)
  }
}

//Delete Quote
async function deleteQuote(id) {
  try {
    const res = await fetch(`${import.meta.env.VITE_APP_URL}/quotes/${id}`, {
      method: "DELETE",
    })
    if (!res.ok) throw new Error("Failed to delete quote")
    return true
  } catch (error) {
    alert(error)
  }
}

export { loadQuotes, createQuote, editQuote, deleteQuote }
 