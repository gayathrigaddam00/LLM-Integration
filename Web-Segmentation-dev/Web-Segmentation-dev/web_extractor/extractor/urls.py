from django.urls import path
from .views import ExtractDataView

urlpatterns = [
    path("extract/", ExtractDataView.as_view(), name="extract_data"), 
    # path("extract-html/", ExtractDataView.as_view(), name="extract_html"),
]
