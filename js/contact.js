
window.addEventListener("DOMContentLoaded",(event)=>{
    inputs = document.querySelectorAll("input:not(input[type=\"submit\"]),textarea");

    inputs.forEach(e => {
        e.addEventListener("click", function() {
            inputs.forEach(e => {
                e.style.borderBottom = "2px solid white";
            })
            e.style.borderBottom = "2px solid black";
            e.style.transform = "translateY(-5px)";
        })
    } )
})

function toogleTour() {
    var tour = document.getElementById("tour");
    if (tour.className === "tour") {
        tour.className += "responsive";
    } else {
        tour.className = "tour";
    }
}