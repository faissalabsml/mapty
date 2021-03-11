'use strict';

const containerWorkouts = document.querySelector('.workouts');
const form = document.querySelector('.form');
const inputType = form.querySelector('.form__input--type');
const inputDistance = form.querySelector('.form__input--distance');
const inputDuration = form.querySelector('.form__input--duration');
const inputCadence = form.querySelector('.form__input--cadence');
const inputElevation = form.querySelector('.form__input--elevation');

const editBtn = document.querySelector('.workout__edit');

// prettier-ignore
let formEdit, editInputType, editInputDistance, editInputDuration, editInputCadence, editInputElevation;

const sortBtn = document.querySelector('.form__input--sort');

const errorMessage = document.querySelector('.error-message');
const deleteAllBtn = document.querySelector('.delete-all');

//* WORKOUT CLASS
class Workout {
  constructor(coords, duration, distance) {
    this.coords = coords; // Array
    this.duration = duration; // Min
    this.distance = distance; // Km
    this.id = (Date.now() + '').slice(-10);
    this.date = new Date();
    this.marker = {};
  }

  _description() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} On ${
      months[this.date.getMonth()]
    } ${this.date.getDay()}`;
  }
}

// RUNNING CLASS
class Running extends Workout {
  constructor(coords, duration, distance, cadence) {
    super(coords, duration, distance);
    this.type = 'running';
    this.cadence = cadence;
    this.calcPace();
    this._description();
  }

  // Calculate the pace (min/km)
  calcPace() {
    this.pace = this.duration / this.distance;
  }
}

//* CYCLING CLASS
class Cycling extends Workout {
  constructor(coords, duration, distance, elevationGain) {
    super(coords, duration, distance);
    this.type = 'cycling';
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._description();
  }

  // Calculate the speed (km/h)
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
  }
}

//* APP ARCHITECTURE
class App {
  constructor() {
    // Initializing the map
    this._map = null;
    this._mapClickEvent = null;
    this._zoomLevel = 15;
    this._workouts = [];
    this._getPosition();

    // To prevent multiple workouts edit
    this._isEditing = false;

    // Set the default input type
    inputType.value = 'running';

    // Event listeners
    form.addEventListener('submit', this._newWorkout.bind(this));

    // Hide the form if Esc key was hit
    document.addEventListener(
      'keydown',
      function (e) {
        if (e.key === 'Escape') {
          this._hideForm();
          this._isEditing = false;
        }
      }.bind(this)
    );

    // Toggle between cadence and elevation on select change
    inputType.addEventListener(
      'change',
      function () {
        this._toggleElevationField('add');
      }.bind(this)
    );

    // Listen to workouts click events
    containerWorkouts.addEventListener(
      'click',
      function (e) {
        if (!e.target.closest('.workout')) return;

        // Move the map tp the workout marker
        this._moveToMarker(e);

        // Handle edit
        if (e.target.closest('.workout__edit')) this._getEditedWorkout(e);

        // Handle delete
        if (e.target.closest('.workout__remove')) this._deleteWorkout(e);
      }.bind(this)
    );

    // Sort button event
    sortBtn.addEventListener('change', this._sortWorkouts.bind(this));

    // Delete all button event
    deleteAllBtn.addEventListener('click', this._deleteAllWorkouts.bind(this));

    // Getting data from the localStorage
    this._getFromLocalStorage();
  }

  // Get the current position of the user
  _getPosition() {
    navigator.geolocation.getCurrentPosition(
      this._loadMap.bind(this),
      function () {
        alert('Something wrong happened :(');
      }
    );
  }

  // Load the laeflet map
  _loadMap(position) {
    const { latitude, longitude } = position.coords;

    this._map = L.map('map').setView([latitude, longitude], this._zoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this._map);

    this._map.on(
      'click',
      function (e) {
        this._showForm(e);
      }.bind(this)
    );

    // Displaying localStorage's saved data
    if (!this._workouts.length) return;
    this._workouts.forEach(workout => this._displayWorkoutMarker(workout));
  }

  // Display the form
  _showForm(e) {
    this._mapClickEvent = e;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  // Hide the form
  _hideForm() {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value =
      '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  // Display error message
  _errorMessage() {
    errorMessage.classList.remove('hidden');
    setTimeout(() => errorMessage.classList.add('hidden'), 2000);
  }

  // Toggle between elevation or cadence fields
  _toggleElevationField(type) {
    if (type === 'add') {
      inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.toggle('form__row--hidden');
    }
    if (type === 'edit') {
      editInputCadence
        .closest('.form__row')
        .classList.toggle('form__row--hidden');
      editInputElevation
        .closest('.form__row')
        .classList.toggle('form__row--hidden');
    }
  }

  // Check if the input values are numbers
  _checkInputs(...inputs) {
    return inputs.every(input => Number.isFinite(input));
  }

  // Check if the input values are positive
  _checkPositive(...inputs) {
    return inputs.every(input => input > 0);
  }

  // Create new workout
  _newWorkout(e) {
    e.preventDefault();

    // Get data from the form and coordinates from the map
    const type = inputType.value;
    const duration = +inputDuration.value;
    const distance = +inputDistance.value;

    // Get the current coords
    const { lat, lng } = this._mapClickEvent.latlng;

    let workout;

    // Create a new Running object if it's Running
    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        !this._checkInputs(duration, distance, cadence) ||
        !this._checkPositive(duration, distance, cadence)
      )
        return this._errorMessage();

      workout = new Running([lat, lng], duration, distance, cadence);
    }

    // Create a new Cycling object if it's Cycling
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !this._checkInputs(duration, distance, elevation) ||
        !this._checkPositive(duration, distance)
      )
        return this._errorMessage();

      workout = new Cycling([lat, lng], duration, distance, elevation);
    }

    // Add the newly created workout to the workout array
    this._workouts.push(workout);

    // Set workout Pin
    this._displayWorkoutMarker(workout);

    // Display a new workout on the workouts list
    this._displayWorkoutItem(workout, form);

    // Hide the form and clear the fields
    this._hideForm();

    // Save the current workouts array to the localStorage
    this._setToLocalStorage();
  }

  // Display edit form
  _showEditForm(workout, workoutEl) {
    const html = `
    <form class="form-edit">
      <div class="form__row">
        <label class="form__label">Type</label>
        <select class="form__input form__input--type">
          <option value="running">Running</option>
          <option value="cycling">Cycling</option>
        </select>
      </div>
      <div class="form__row">
        <label class="form__label">Distance</label>
        <input class="form__input form__input--distance" placeholder="km" />
      </div>
      <div class="form__row">
        <label class="form__label">Duration</label>
        <input
          class="form__input form__input--duration"
          placeholder="min"
        />
      </div>
      <div class="form__row ${
        workout.type === 'running' ? '' : 'form__row--hidden'
      }">
        <label class="form__label">Cadence</label>
        <input
          class="form__input form__input--cadence"
          placeholder="step/min"
        />
      </div>
      <div class="form__row ${
        workout.type === 'cycling' ? '' : 'form__row--hidden'
      }">
        <label class="form__label">Elev Gain</label>
        <input
          class="form__input form__input--elevation"
          placeholder="meters"
        />
      </div>
      <button class="form__btn">OK</button>
    </form>
  `;

    workoutEl.insertAdjacentHTML('beforebegin', html);
  }

  // Get clicked workout for editing
  _getEditedWorkout(e) {
    // Check the editing status and set it to true
    if (this._isEditing) return;
    this._isEditing = true;

    // Find the clocked workout in this._workouts array (object and HTML)
    const ID = e.target.closest('.workout').dataset.id;
    const workoutIndex = this._workouts.findIndex(workout => workout.id === ID);
    const workout = this._workouts[workoutIndex];

    // Get the workout element in the DOM to change later
    const workoutHTML = e.target.closest(`[data-id="${ID}"]`);

    // Hide the clicked workout and replace it with the edit form
    workoutHTML.classList.add('none');
    this._showEditForm(workout, workoutHTML);

    // Get the input elements
    formEdit = document.querySelector('.form-edit');
    editInputType = formEdit.querySelector('.form__input--type');
    editInputDistance = formEdit.querySelector('.form__input--distance');
    editInputDuration = formEdit.querySelector('.form__input--duration');
    editInputCadence = formEdit.querySelector('.form__input--cadence');
    editInputElevation = formEdit.querySelector('.form__input--elevation');

    // Set the form default value to the current workout data
    editInputDistance.value = workout.distance;
    editInputDuration.value = workout.duration;
    editInputType.value = workout.type;
    workout.type === 'running'
      ? (editInputCadence.value = workout.cadence)
      : (editInputElevation.value = workout.elevationGain);

    // Change between elevation or cadence on select change
    editInputType.addEventListener(
      'change',
      function () {
        this._toggleElevationField('edit');
      }.bind(this)
    );

    // Cancel the edit if Esc key was hit
    document.addEventListener(
      'keydown',
      function (e) {
        if (e.key === 'Escape') {
          formEdit.remove();
          workoutHTML.classList.remove('none');
          this._isEditing = false;
        }
      }.bind(this)
    );

    // Call _addEditedWorkout on form submit
    formEdit.addEventListener(
      'submit',
      function (e) {
        e.preventDefault();
        this._addEditedWorkout(workoutIndex, workoutHTML);
      }.bind(this)
    );
  }

  // Submit the edited workout
  _addEditedWorkout(index, workoutEL) {
    // Get the workout previous values to keep
    const workout = this._workouts[index];
    const date = workout.date;
    const id = workout.id;
    const marker = workout.marker;

    // Get data from the form and coordinates from the map
    const type = editInputType.value;
    const duration = +editInputDuration.value;
    const distance = +editInputDistance.value;

    let newWorkout;

    // Create a new Running object if type is running
    if (type === 'running') {
      const cadence = +editInputCadence.value;
      if (
        !this._checkInputs(duration, distance, cadence) ||
        !this._checkPositive(duration, distance, cadence)
      )
        return this._errorMessage();

      newWorkout = new Running(workout.coords, duration, distance, cadence);
    }

    // Create a new Cycling object if type is cycling
    if (type === 'cycling') {
      const elevation = +editInputElevation.value;
      if (
        !this._checkInputs(duration, distance, elevation) ||
        !this._checkPositive(duration, distance)
      )
        return this._errorMessage();

      newWorkout = new Cycling(workout.coords, duration, distance, elevation);
    }

    // Transfer those properties from the old workout obj
    newWorkout.id = id;
    newWorkout.data = date;
    newWorkout.marker = marker;

    // Delete the old workout from the _workouts array
    this._workouts.splice(index, 1, newWorkout);

    // Change the marker
    this._map.removeLayer(marker);
    this._displayWorkoutMarker(newWorkout);

    // Change the HTML of the element
    this._displayWorkoutItem(newWorkout, formEdit);

    // Remove the edit form from
    formEdit.remove();

    // Save the current workouts array to the localStorage
    this._setToLocalStorage();

    // Change editing status to false
    this._isEditing = false;
  }

  // Display the new workout on the map
  _displayWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this._map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    workout.marker = marker;
  }

  // Display new workout in workouts list
  _displayWorkoutItem(workout, form) {
    const html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <div class="workout__container">
          <div class="workout__infos">
            <h2 class="workout__title">${workout.description}</h2>
            <span class="workout__edit">✏️ Edit</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${
              workout.type === 'running'
                ? workout.pace.toFixed(1)
                : workout.speed.toFixed(1)
            }</span>
            <span class="workout__unit">${
              workout.type === 'running' ? 'min/km' : 'km/h'
            }</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🦶🏼' : '⛰'
            }</span>
            <span class="workout__value">${
              workout.type === 'running'
                ? workout.cadence
                : workout.elevationGain
            }</span>
            <span class="workout__unit">${
              workout.type === 'running' ? 'stm' : 'm'
            }</span>
          </div>
        </div>
        <div class="workout__remove">❌</div>
      </li>
    `;

    form.insertAdjacentHTML('afterend', html);
  }

  // Move the map to the selected workout
  _moveToMarker(e) {
    const workoutItem = e.target.closest('.workout');
    // if (!workoutItem) return;

    const workout = this._workouts.find(
      workout => workout.id === workoutItem.dataset.id
    );

    this._map.setView(workout.coords, this._zoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  // Sort workouts
  _sortWorkouts() {
    // Get the values from select element
    const [value, sorting] = sortBtn.value.split('-');

    // Sort both running and cycling workouts
    if (value === 'distance' || value === 'duration') {
      // Clone the _workouts array for sorting and to prevent modifying the original array
      let sortedArr = [...this._workouts];

      this._updateWorkoutsList(sortedArr, value, sorting);
    }

    // Check if the values are cadence or pace and select only objects containing those values as properties (running)
    if (value === 'cadence' || value === 'pace') {
      // Select only the running workouts objects
      let runningWorkoutsArr = this._workouts.filter(
        workout => workout.type === 'running'
      );

      this._updateWorkoutsList(runningWorkoutsArr, value, sorting);
    }

    // Check if the values are cadence or pace and select only objects containing those values as properties (cycling)
    if (value === 'elevationGain' || value === 'speed') {
      // Select only cycling objects
      let cyclingWorkoutsArr = this._workouts.filter(
        workout => workout.type === 'cycling'
      );

      this._updateWorkoutsList(cyclingWorkoutsArr, value, sorting);
    }

    // Change to the default sorting
    if (value === 'default') this._updateWorkoutsList(this._workouts);
  }

  // Update workouts list
  _updateWorkoutsList(workouts, value, sorting) {
    containerWorkouts.querySelectorAll('li').forEach(el => el.remove());

    if (!value && !sorting) {
      workouts.forEach(workout => this._displayWorkoutItem(workout, form));
    } else {
      sorting === 'asc'
        ? workouts.sort((a, b) => a[value] - b[value]).reverse() // Reverse is for the displaying it correctly on the DOM
        : workouts.sort((a, b) => b[value] - a[value]).reverse();
      workouts.forEach(workout => this._displayWorkoutItem(workout, form));
    }
  }

  // Delete a workout
  _deleteWorkout(e) {
    // Get the workout element
    const ID = e.target.closest('.workout').dataset.id;
    const workoutEl = document.querySelector(`[data-id="${ID}"]`);

    // Get the workout from the workouts array
    const workoutIndex = this._workouts.findIndex(workout => workout.id === ID);
    const marker = this._workouts[workoutIndex].marker;

    // Remove the workout from the array, the DOM and delete the marker
    this._workouts.splice(workoutIndex, 1);
    this._map.removeLayer(marker);
    workoutEl.remove();

    this._setToLocalStorage();
  }

  // Delete all workouts and clear the UI and the map
  _deleteAllWorkouts() {
    if (!this._workouts.length) return;

    // Remove all markers from the map object
    this._workouts
      .map(workout => workout.marker)
      .forEach(marker => this._map.removeLayer(marker));

    // Empty the workouts array
    this._workouts = [];

    // Remove the workouts from the UI
    containerWorkouts.querySelectorAll('li').forEach(el => el.remove());

    // UPdate the localStorage
    this._setToLocalStorage();
  }

  // Since JSON.stringify doesn't support circular references, I found a parser that does that on github called Flatted (https://github.com/WebReflection/flatted#flatted)
  // Save data to localStorage
  _setToLocalStorage() {
    localStorage.setItem('workouts', Flatted.stringify(this._workouts));

    Flatted.stringify(this._workouts);
  }

  // Get the data from the localStorage
  _getFromLocalStorage() {
    if (!window.localStorage.length) return;
    const data = Flatted.parse(localStorage.getItem('workouts'));

    if (!data) return;

    // Fill the workouts array with the data from localStorage
    this._workouts = data;

    // Display the workouts list
    this._workouts.forEach(workout => this._displayWorkoutItem(workout, form));
  }

  // For development purposes
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
