<template>
  <div>
    <!---------------------------------------------------------------------------->
    <!---------------------- EMAIL 6 PASSWORD LOGIN  --------------------------->
    <!---------------------------------------------------------------------------->
    <q-card class="my-card fixed-center" style="min-width: 400px; max-width: 750px">
      <q-card-section>
        <div class="text-h5 text-center">Welcome to F.I.R.E planner!</div>
      </q-card-section>

      <!-- LOGIN WITH GOOGLE METHOD -->
      <q-card-section>
        <div v-if="tab === false">
          <p class="text-center">Do you have a Google account? Signup with Google</p>

          <div class="container" id="GoogleSignIn">
            <q-btn flat @click="handleSignInGoogle()">
              <q-img src="myAssets/googleSignUp.png" style="width: 250px; height: 50px" />
            </q-btn>
          </div>
        </div>

        <div v-else>
          <p class="text-center">Do you have a Google account? Login with Google</p>

          <div class="container" id="GoogleSignIn">
            <q-btn flat @click="handleLoginInGoogle()">
              <q-img src="myAssets/googleSignUp_v2.png" style="width: 250px; height: 50px" />
            </q-btn>
          </div>
        </div>
      </q-card-section>

      <!-- FORM LOGIN - only shown if "tab == true" (initial value set as true) -->
      <q-card-section class="q-mt-none q-pt-none" v-if="tab">
        <p class="q-mt-lg text-center">You can also use your email/password to Login</p>

        <q-form class="q-gutter-md" @submit.prevent="onLogin">
          <q-input
            dense
            rounded
            outlined
            v-model="credentials.email"
            type="email"
            label="Enter your email"
          />

          <q-input
            dense
            rounded
            outlined
            v-model="credentials.password"
            type="password"
            label="Enter your password"
          />

          <!-- <q-btn
                class="submit-btn"
                label="Login"
                no-caps
                type="submit"
                /> -->

          <div class="container">
            <q-btn
              class="q-mt-sm q-mr-sm"
              style="height: 75%"
              label="Login"
              rounded
              color="orange"
              no-caps
              type="submit"
            />
          </div>
        </q-form>

        <br />

        <p>
          Don't you have an account yet? Please
          <q-btn flat padding="none" no-caps style="color: #fca311" @click="tab = !tab">
            Signup
          </q-btn>
        </p>
      </q-card-section>

      <!-- FORM SIGN UP - only shown if "tab == false" -->
      <q-card-section class="q-mt-none q-pt-none" v-else>
        <p class="q-mt-lg text-center">You can also use your email/password to Signup</p>

        <q-form @submit="onSignUp" class="q-gutter-md">
          <q-input
            dense
            rounded
            outlined
            v-model="credentials.email"
            type="email"
            label="Enter your email"
          />

          <q-input
            dense
            rounded
            outlined
            v-model="credentials.password"
            type="password"
            label="Enter your password"
          />

          <!-- <q-btn
                    class="submit-btn"
                    label="Signup"
                    no-caps
                    type="submit"
                /> -->

          <q-checkbox
            v-model="disclaimerModel"
            label="By checking this box, you are agreeing to our terms of service."
          />

          <q-expansion-item
            expand-separator
            icon="book"
            label="Read the Terms of service before signing up"
          >
            <div class="q-ma-md">
              <q-scroll-area style="height: 200px; max-width: 400px">
                <div v-for="n in 100" :key="n" class="q-py-xs">
                  The information provided by FIRE Planner is for general informational purposes
                  only. All information on the app is provided in good faith, however, we make no
                  representation or warranty of any kind, express or implied, regarding the
                  accuracy, adequacy, validity, reliability, availability, or completeness of any
                  information on the app. <br />
                  <br />
                  Your use of the app and your reliance on any information provided is solely at
                  your own risk. FIRE Planner is not responsible for any financial decisions you
                  make based on the information provided in the app. You should consult with a
                  qualified financial advisor before making any financial decisions.<br />
                  <br />
                  FIRE Planner may include links to other websites or content belonging to or
                  originating from third parties or links to websites and features in banners or
                  other advertising. Such external links are not investigated, monitored, or checked
                  for accuracy, adequacy, validity, reliability, availability, or completeness by
                  us. <br />
                  <br />
                  We do not warrant, endorse, guarantee, or assume responsibility for the accuracy
                  or reliability of any information offered by third-party websites linked through
                  the app or any website or feature linked in any banner or other advertising. We
                  will not be a party to or in any way be responsible for monitoring any transaction
                  between you and third-party providers of products or services. <br />
                  <br />
                  FIRE Planner reserves the right to discontinue or alter any aspect of the app at
                  any time without prior notice.<br />
                  <br />
                  FIRE Planner does not provide any warranties regarding the performance or
                  operation of the app. We do not guarantee that the app will be available at all
                  times or that it will be free from errors, viruses, or other harmful
                  components.<br />
                  <br />
                  By using the app, you agree to indemnify, defend, and hold harmless FIRE Planner,
                  its affiliates, and their respective officers, directors, employees, agents, and
                  representatives from and against any and all claims, liabilities, damages, losses,
                  costs, expenses, or fees (including reasonable attorneys' fees) that may arise
                  from your use of the app.<br />
                </div>
              </q-scroll-area>
            </div>
          </q-expansion-item>

          <div class="container">
            <q-btn
              class="q-mt-sm q-mr-sm"
              style="height: 75%"
              label="Signup"
              rounded
              color="orange"
              no-caps
              type="submit"
            />
          </div>
        </q-form>

        <br />

        <p>
          Do you already have an account? Please
          <q-btn
            flat
            padding="none"
            no-caps
            style="color: #fca311"
            label="Login"
            @click="tab = !tab"
          />
        </p>
      </q-card-section>
    </q-card>
  </div>
</template>

<!-- eslint-disable no-unused-vars -->
<script setup>
import { ref, reactive } from 'vue'
// import { getAuth, GoogleAuthProvider } from 'firebase/auth'

// console.log(firebaseConfig)

// -------------------------------------------------------------------------------------
// ------------------------- EMAIL 6 PASSWORD LOGIN ------------------------------------
// -------------------------------------------------------------------------------------
// import and declare storeAuth
import { useStoreAuth } from 'src/stores/storeAuth'
import { useQuasar } from 'quasar'

// declare useQuasar (to use the "notify" plugin)
const $q = useQuasar()

const storeAuth = useStoreAuth()

// show right form, when true shows Login Form, when false show Signup Form
const tab = ref(false)
const disclaimerModel = ref(false)

// Define credentials
const credentials = reactive({
  email: '',
  password: '',
})

// @submit Login Form => Login Existing User
function onLogin() {
  storeAuth.loginUser(credentials)
}

function handleSignInGoogle() {
  if (disclaimerModel.value !== true) {
    $q.notify({
      message: 'please agree with the terms of service before signing up to FirePlanner',
      color: 'danger',
      icon: 'check_circle',
      timeout: 4000,
    })
  } else {
    console.log('starting the sign up process')
    storeAuth.loginUserWithGoogle()
  }
}

function handleLoginInGoogle() {
  console.log('starting the login process')
  storeAuth.loginUserWithGoogle()
}

// @submit Sigup Form => Sign up New User
function onSignUp() {
  if (disclaimerModel.value !== true) {
    $q.notify({
      message: 'please agree with the terms of service before signing up to FirePlanner',
      color: 'danger',
      icon: 'check_circle',
      timeout: 4000,
    })
  } else {
    console.log('starting the sign up process')
    storeAuth.registerUser(credentials)
  }
  // router.push('/login')
}

// -------------------------------------------------------------------------------------
// ---------------------------- GOOGLE LOGIN -------------------------------------------
// -------------------------------------------------------------------------------------

// const provider = new GoogleAuthProvider()
// const auth = getAuth()

// const msg = ref('')
// const user = ref('')
// const isSignedIn = ref(false)

// function handleSignInGoogle () {
//   signInWithPopup(auth, provider)
//     .then((result) => {
//       // const user = result.user;
//       // console.log(result.user.displayName)
//       user.value = result.user.displayName
//       isSignedIn.value = true
//     }).catch((error) => {
//       console.log(error)
//     })
// }

// function handleSignOut () {
//   signOut(auth).then(() => {
//     user.value = ''
//     isSignedIn.value = false
//   }).catch((error) => {
//     console.log(error)
//   })
// }
</script>

<style scoped>
.q-card {
  border-radius: 25px;
}

.container {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
