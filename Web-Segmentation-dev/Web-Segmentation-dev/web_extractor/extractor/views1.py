import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


def get_relative_xpath(element):
    """
    Generate a relative XPath for the given element.
    """
    tag_name = element.tag_name

    # Use ID if available
    id_attr = element.get_attribute("id")
    if id_attr:
        return f"//{tag_name}[@id='{id_attr}']"

    # Use class if available
    class_attr = element.get_attribute("class")
    if class_attr:
        return f"//{tag_name}[@class='{class_attr}']"

    # Build XPath using other attributes
    attributes = element.get_property("attributes")
    conditions = []
    for attr in attributes:
        if attr["name"] not in ["id", "class", "style", "hidden"]:
            conditions.append(f"@{attr['name']}='{attr['value']}'")

    condition_str = " and ".join(conditions)
    return f"//{tag_name}[{condition_str}]" if conditions else f"//{tag_name}"


class ExtractDataView(APIView):
    def post(self, request):
        print("Inside views1.py")
        html_content = request.data.get("html")

        if not html_content:
            return Response({"error": "No HTML received"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Step 1: Set up Selenium WebDriver
            options = webdriver.ChromeOptions()
            options.add_argument("--headless")  # Run in headless mode
            driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)

            # Step 2: Load the HTML content into Selenium
            print("Loading HTML content into Selenium...")
            driver.get("data:text/html;charset=utf-8," + html_content)

            # Step 3: Wait for content to load (if applicable)
            try:
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.XPATH, "//*"))  # Wait for all elements to load
                )
            except Exception as e:
                print(f"Timeout waiting for content: {e}")

            # Step 4: Extract information for all elements
            elements = driver.find_elements(By.XPATH, "//*")
            print(f"Number of elements found: {len(elements)}")  # Debug: Check element count
            data = []

            for elem in elements:
                try:
                    # Get attributes and properties of the element
                    relative_xpath = get_relative_xpath(elem)
                    x = elem.location["x"]
                    y = elem.location["y"]
                    width = elem.size["width"]
                    height = elem.size["height"]
                    bg_color = elem.value_of_css_property("background-color")
                    font_size = elem.value_of_css_property("font-size")
                    font_style = elem.value_of_css_property("font-style")
                    font_color = elem.value_of_css_property("color")
                    text = elem.text.strip()

                    # Append the data
                    data.append({
                        "Relative XPath": relative_xpath,
                        "x": x,
                        "y": y,
                        "width": width,
                        "height": height,
                        "background-color": bg_color,
                        "font-size": font_size,
                        "font-style": font_style,
                        "font-color": font_color,
                        "text": text,
                    })
                except Exception as e:
                    print(f"Error processing element: {e}")

            # Save data to a DataFrame
            df = pd.DataFrame(data)
            print(df)

            # Save to CSV
            file_path = "extracted_elements.csv"
            df.to_csv(file_path, index=False)
            print(f"Data saved to {file_path}")

            # Quit the driver
            driver.quit()

            return Response({"message": "Elements extracted successfully", "rows": len(df)}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# import pandas as pd
# from rest_framework.views import APIView
# from rest_framework.response import Response
# from rest_framework import status
# from selenium import webdriver
# from selenium.webdriver.common.by import By
# from selenium.webdriver.chrome.service import Service as ChromeService
# from webdriver_manager.chrome import ChromeDriverManager
# from io import StringIO

# # class ExtractDataView(APIView):
# #     # def post(self, request):
# #     #     # Extract JSON data from the request
# #     #     print("Inside Views.py")
# #     #     elements = request.data.get("elements", [])
# #     #     if not elements:
# #     #         return Response({"error": "No data received"}, status=status.HTTP_400_BAD_REQUEST)

# #     #     try:
# #     #         # Convert data into a Pandas DataFrame
# #     #         df = pd.DataFrame(elements)
# #     #         print("Data saved in DataFrame:")
# #     #         print(df)

# #     #         # Optionally save DataFrame to a CSV file
# #     #         file_path = "extracted_data.csv"
# #     #         df.to_csv(file_path, index=False)
# #     #         print(f"Data saved to {file_path}")

# #     #         return Response({"message": "Data processed successfully", "rows": len(df)}, status=status.HTTP_200_OK)

# #     #     except Exception as e:
# #     #         return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# #     def post(self, request):
# #         # Step 1: Get HTML from request
# #         html_content = request.data.get("html")
# #         if not html_content:
# #             return Response({"error": "No HTML received"}, status=status.HTTP_400_BAD_REQUEST)

# #         try:
# #             # Step 2: Set up Selenium WebDriver
# #             options = webdriver.ChromeOptions()
# #             options.add_argument("--headless")  # Run in headless mode
# #             driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)

# #             # Step 3: Load HTML into Selenium
# #             driver.get("data:text/html;charset=utf-8," + html_content)

# #             # Step 4: Extract attributes for all elements
# #             elements_data = []
# #             for element in driver.find_elements(By.XPATH, "//*"):
# #                 try:
# #                     elements_data.append({
# #                         "xpath": driver.execute_script(
# #                             """
# #                             function getXPath(element) {
# #                                 if (!element) return "";
# #                                 if (element.id) return `//*[@id="${element.id}"]`;
# #                                 if (element === document.body) return "/html/body";
# #                                 if (element === document.documentElement) return "/html";
                                
# #                                 var ix = 0;
# #                                 var siblings = element.parentNode ? element.parentNode.childNodes : [];
# #                                 for (var i = 0; i < siblings.length; i++) {
# #                                     var sibling = siblings[i];
# #                                     if (sibling === element) {
# #                                         return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
# #                                     }
# #                                     if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
# #                                         ix++;
# #                                     }
# #                                 }
# #                                 return "";
# #                             }
# #                             return getXPath(arguments[0]);
# #                             """,
# #                             element),
# #                         "width": element.rect["width"],
# #                         "height": element.rect["height"],
# #                         "x": element.rect["x"],
# #                         "y": element.rect["y"],
# #                         "background_color": element.value_of_css_property("background-color"),
# #                         "font_color": element.value_of_css_property("color"),
# #                         "font_size": element.value_of_css_property("font-size"),
# #                         "font_style": element.value_of_css_property("font-style"),
# #                         "text": element.text.strip(),
# #                     })
# #                 except Exception as e:
# #                     print(f"Error processing element: {e}")

# #             driver.quit()

# #             # Step 5: Convert data to a Pandas DataFrame
# #             df = pd.DataFrame(elements_data)
# #             print(df)

# #             file_path = "sel-extracted_data.csv"
# #             df.to_csv(file_path, index=False)
# #             print(f"Data saved to {file_path}")

# #             return Response({"message": "Data processed successfully", "rows": len(df)}, status=status.HTTP_200_OK)

# #         except Exception as e:
# #             return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# #         #     return Response({"message": "HTML processed successfully", "rows": len(df)}, status=status.HTTP_200_OK)

# #         # except Exception as e:
# #         #     return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# # def get_relative_xpath(element):
# #     """Generate a relative XPath for the given element."""
# #     tag_name = element.tag_name

# #     # Get the ID if present
# #     id_attr = element.get_attribute("id")
# #     if id_attr:
# #         return f"//{tag_name}[@id='{id_attr}']"

# #     # Get the class if present
# #     class_attr = element.get_attribute("class")
# #     if class_attr:
# #         return f"//{tag_name}[@class='{class_attr}']"

# #     # Get other attributes to form a unique relative XPath
# #     attributes = element.get_property("attributes")
# #     conditions = []
# #     for attr in attributes:
# #         if attr["name"] not in ["id", "class", "style", "hidden"]:
# #             conditions.append(f"@{attr['name']}='{attr['value']}'")

# #     condition_str = " and ".join(conditions)
# #     return f"//{tag_name}[{condition_str}]" if conditions else f"//{tag_name}"

# def get_relative_xpath(element):
#     tag_name = element.tag_name
#     # Get the ID if present
#     id_attr = element.get_attribute("id")
#     if id_attr:
#         return f"//{tag_name}[@id='{id_attr}']"

#     # Get the class if present
#     class_attr = element.get_attribute("class")
#     if class_attr:
#         return f"//{tag_name}[@class='{class_attr}']"

#     # Get attributes to form a unique relative XPath
#     attributes = element.get_property("attributes")
#     conditions = []
#     for attr in attributes:
#         if attr["name"] not in ["id", "class", "style", "hidden"]:
#             conditions.append(f"@{attr['name']}='{attr['value']}'")

#     condition_str = " and ".join(conditions)
#     return f"//{tag_name}[{condition_str}]" if conditions else f"//{tag_name}"



# # class ExtractDataView(APIView):
# #     def post(self, request):
# #         # Step 1: Get HTML from the request
# #         print("Inside views.py")
# #         html_content = request.data.get("html")
# #         if not html_content:
# #             return Response({"error": "No HTML received"}, status=status.HTTP_400_BAD_REQUEST)

# #         try:
# #             # Step 2: Set up Selenium WebDriver
# #             options = webdriver.ChromeOptions()
# #             options.add_argument("--headless")  # Run in headless mode
# #             driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)

# #             # Step 3: Load the HTML content into Selenium
# #             driver.get("data:text/html;charset=utf-8," + html_content)

# #             # Step 4: Extract information for all elements
# #             elements = driver.find_elements(By.XPATH, "//*")
# #             data = []

# #             for elem in elements:
# #                 try:
# #                     # Get attributes and properties of the element
# #                     relative_xpath = get_relative_xpath(elem)
# #                     x = elem.location["x"]
# #                     y = elem.location["y"]
# #                     width = elem.size["width"]
# #                     height = elem.size["height"]
# #                     bg_color = elem.value_of_css_property("background-color")
# #                     font_size = elem.value_of_css_property("font-size")
# #                     font_style = elem.value_of_css_property("font-style")
# #                     font_color = elem.value_of_css_property("color")
# #                     text = elem.text.strip()

# #                     # Append the data
# #                     data.append({
# #                         "Relative XPath": relative_xpath,
# #                         "x": x,
# #                         "y": y,
# #                         "width": width,
# #                         "height": height,
# #                         "background-color": bg_color,
# #                         "font-size": font_size,
# #                         "font-style": font_style,
# #                         "font-color": font_color,
# #                         "text": text,
# #                     })
# #                 except Exception as e:
# #                     print(f"Error processing element: {e}")

# #             # Step 5: Save data to a Pandas DataFrame
# #             df = pd.DataFrame(data)
# #             print(df)

# #             # Optionally save DataFrame to a CSV file
# #             file_path = "extracted_elements.csv"
# #             df.to_csv(file_path, index=False)
# #             print(f"Data saved to {file_path}")

# #             # Quit the driver
# #             driver.quit()

# #             return Response({"message": "Elements extracted successfully", "rows": len(df)}, status=status.HTTP_200_OK)

# #         except Exception as e:
# #             return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
