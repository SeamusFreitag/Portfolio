document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("myForm");

    document.querySelectorAll("[data-open-form]").forEach(function (el) {
        el.addEventListener("click", function (e) {
            e.preventDefault();
            form.style.display = "block";
        });
    });

    document.querySelectorAll("[data-close-form]").forEach(function (el) {
        el.addEventListener("click", function () {
            form.style.display = "none";
        });
    });
});