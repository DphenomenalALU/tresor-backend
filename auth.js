document.addEventListener("DOMContentLoaded", () => {
  // Tab switching functionality
  const tabBtns = document.querySelectorAll(".tab-btn")
  const authForms = document.querySelectorAll(".auth-form")
  const errorMessage = document.getElementById("error-message")

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove active class from all tabs and forms
      tabBtns.forEach((b) => b.classList.remove("active"))
      authForms.forEach((f) => f.classList.remove("active"))

      // Add active class to clicked tab and corresponding form
      btn.classList.add("active")
      const formId = `${btn.dataset.tab}-form`
      document.getElementById(formId).classList.add("active")

      // Clear error message when switching tabs
      errorMessage.textContent = ""
    })
  })

  // Check if user is already logged in
  const currentUser = localStorage.getItem("currentUser")
  if (currentUser) {
    window.location.href = "chat.html"
  }

  // Handle Google Sign-In
  window.handleGoogleLogin = async (response) => {
    try {
      // Send the credential to our server
      const serverResponse = await fetch('/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credential: response.credential
        })
      });

      if (!serverResponse.ok) {
        throw new Error('Failed to verify Google credentials');
      }

      const data = await serverResponse.json();
      
      // Store user data in localStorage
      localStorage.setItem("currentUser", JSON.stringify(data.user));

      // Redirect to chat page
      window.location.href = "chat.html";
    } catch (error) {
      console.error('Google authentication error:', error);
      errorMessage.textContent = "Failed to authenticate with Google. Please try again.";
    }
  }

  window.handleGoogleSignup = async (response) => {
    // Use the same handler as login since we're handling both cases server-side
    await handleGoogleLogin(response);
  }

  // Login form submission
  const loginForm = document.getElementById("login-form")
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault()

    const email = document.getElementById("login-email").value
    const password = document.getElementById("login-password").value

    // Get users from localStorage
    const users = JSON.parse(localStorage.getItem("users")) || []

    // Find user with matching email
    const user = users.find((u) => u.email === email)

    if (user && user.password === password) {
      // Store current user in localStorage
      localStorage.setItem("currentUser", JSON.stringify(user))

      // Redirect to chat page
      window.location.href = "chat.html"
    } else {
      errorMessage.textContent = "Invalid email or password"
    }
  })

  // Signup form submission
  const signupForm = document.getElementById("signup-form")
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault()

    const name = document.getElementById("signup-name").value
    const email = document.getElementById("signup-email").value
    const password = document.getElementById("signup-password").value
    const confirmPassword = document.getElementById("signup-confirm-password").value

    // Validate passwords match
    if (password !== confirmPassword) {
      errorMessage.textContent = "Passwords do not match"
      return
    }

    // Get existing users from localStorage
    const users = JSON.parse(localStorage.getItem("users")) || []

    // Check if email already exists
    if (users.some((user) => user.email === email)) {
      errorMessage.textContent = "Email already in use"
      return
    }

    // Create new user
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password,
      isGoogleUser: false
    }

    // Add user to users array
    users.push(newUser)

    // Save updated users array to localStorage
    localStorage.setItem("users", JSON.stringify(users))

    // Set current user
    localStorage.setItem("currentUser", JSON.stringify(newUser))

    // Redirect to chat page
    window.location.href = "chat.html"
  })
})

